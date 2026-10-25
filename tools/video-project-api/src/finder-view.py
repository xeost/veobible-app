"""Seed folder preferences where Finder reads them: named records in the parent."""

from pathlib import Path
import fcntl
import hashlib
import io
import os
import stat
import sys
import tempfile

ASSETS = Path(__file__).resolve().parent / "assets"
sys.path.insert(0, str(ASSETS / "finder-metadata-vendor.zip"))
from ds_store import DSStore, DSStoreEntry
from ds_store import buddy
from ds_store.store import codecs

# Preserve every existing blob byte-for-byte, including unknown Finder properties.
codecs.clear()
TEMPLATE = ASSETS / "finder-list-name-ascending.dsstore"
VIEW_CODES = {b"lsvp", b"lsvP", b"lsvC"}


def records(data):
    with DSStore.open(io.BytesIO(data), "r") as store:
        return list(store)


def write_store(filename, entries):
    """Build a complete B-tree without incremental insertion/split edge cases.

    Keep an empty final child when the last entry is promoted to the next level.
    Otherwise a boundary-sized store silently loses its final separator record.
    """
    page_size = 4096
    entries = sorted(entries)
    current = entries
    levels = []
    pointer_size = 0
    while True:
        nodes, promoted, node = [], [], []
        used = 8
        for entry in current:
            size = entry.byte_length() + pointer_size
            if size + 8 > page_size:
                raise ValueError("Finder record exceeds a B-tree page")
            if used + size > page_size:
                nodes.append(node)
                promoted.append(entry)
                node, used = [], 8
            else:
                node.append(entry)
                used += size
        nodes.append(node)
        levels.append(nodes)
        if len(nodes) == 1:
            break
        current = promoted
        pointer_size = 4
    with buddy.Allocator.open(filename, "w+") as allocator:
        master = allocator.allocate(20)
        allocator["DSDB"] = master
        children = None
        for level in levels:
            pointers = []
            child_offset = 0
            for node in level:
                pointer = allocator.allocate(page_size)
                pointers.append(pointer)
                with allocator.get_block(pointer) as block:
                    if children is None:
                        block.write(b">II", 0, len(node))
                        for entry in node:
                            entry.write(block)
                    else:
                        subtree = children[child_offset:child_offset + len(node) + 1]
                        assert len(subtree) == len(node) + 1
                        block.write(b">II", subtree[-1], len(node))
                        for child, entry in zip(subtree, node):
                            block.write(b">I", child)
                            entry.write(block)
                        child_offset += len(node) + 1
                    block.zero_fill()
            children = pointers
        with allocator.get_block(master) as block:
            block.write(b">IIIII", children[0], len(levels) - 1, len(entries),
                        sum(len(level) for level in levels), page_size)


def seed_store(target, name, force=False):
    # Lock a stable path outside the working directory across atomic replacements.
    locks = Path(tempfile.gettempdir()) / f"veobible-finder-{os.getuid()}"
    locks.mkdir(mode=0o700, exist_ok=True)
    lock = locks / hashlib.sha256(os.fsencode(target)).hexdigest()
    with lock.open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        for attempt in range(3):
            try:
                original = target.read_bytes()
                mode = stat.S_IMODE(target.stat().st_mode)
            except FileNotFoundError:
                original = None
                mode = 0o644
            existing = records(original) if original is not None else []
            if not force and any(
                entry.filename == name and entry.code in VIEW_CODES
                for entry in existing
            ):
                return
            defaults = [
                DSStoreEntry(name, entry.code, entry.type, entry.value)
                for entry in records(TEMPLATE.read_bytes())
            ]
            # A flat Name ordering must not inherit a grouping such as Kind.
            defaults.append(DSStoreEntry(name, b"GRP0", b"ustr", "None"))
            keys = {(entry.filename, entry.code) for entry in defaults}
            merged = [entry for entry in existing if (entry.filename, entry.code) not in keys]
            merged.extend(defaults)
            fd, temporary = tempfile.mkstemp(prefix=".finder-", dir=target.parent)
            os.close(fd)
            try:
                write_store(temporary, merged)
                # Do not publish an unreadable tree or lose records during serialization.
                written = records(Path(temporary).read_bytes())
                assert len(written) == len(merged)
                assert {
                    (e.filename, e.code): (e.type, e.value) for e in written
                } == {
                    (e.filename, e.code): (e.type, e.value) for e in merged
                }
                os.chmod(temporary, mode)
                # Finder does not take our lock; retry if it updated the file meanwhile.
                current = target.read_bytes() if target.exists() else None
                if current != original:
                    continue
                os.replace(temporary, target)
                return
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
        raise RuntimeError(f"Finder preferences changed repeatedly: {target}")


def initialize(directory, force=False, reset_self=False):
    directory = Path(directory).resolve(strict=True)
    seed_store(directory.parent / ".DS_Store", directory.name, force=force)
    if reset_self:
        seed_store(directory / ".DS_Store", ".", force=True)


if __name__ == "__main__":
    force = "--force" in sys.argv[1:]
    reset_self = "--reset-self" in sys.argv[1:]
    for argument in sys.argv[1:]:
        if argument not in ("--force", "--reset-self"):
            initialize(argument, force=force, reset_self=reset_self)
