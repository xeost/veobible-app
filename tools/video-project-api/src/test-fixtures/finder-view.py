"""Check actual parent-folder records, rather than only the copied template."""

from pathlib import Path
import importlib.util
import plistlib
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
source = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("finder_view", source / "finder-view.py")
finder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(finder)


def check(directory):
    directory = Path(directory)
    entries = {
        entry.code: entry
        for entry in finder.records((directory.parent / ".DS_Store").read_bytes())
        if entry.filename == directory.name
    }
    assert entries[b"vstl"].value == b"Nlsv"
    assert entries[b"GRP0"].value == "None"
    for key in (b"lsvp", b"lsvP", b"lsvC"):
        settings = plistlib.loads(entries[key].value)
        assert settings["sortColumn"] == "name"
        columns = settings["columns"]
        name = next(c for c in columns if c["identifier"] == "name") if isinstance(columns, list) else columns["name"]
        assert name["ascending"] is True


class FinderViewTests(unittest.TestCase):
    def test_view_style_without_sort_preferences_does_not_skip_initialization(self):
        with tempfile.TemporaryDirectory() as root:
            project = Path(root) / "project"
            project.mkdir()
            ds = project.parent / ".DS_Store"
            finder.write_store(str(ds), [
                finder.DSStoreEntry(project.name, b"vstl", b"type", b"Nlsv"),
            ])
            finder.initialize(project)
            check(project)

    def test_boundary_record_and_multiple_internal_levels(self):
        with tempfile.TemporaryDirectory() as root:
            target = str(Path(root) / ".DS_Store")
            for count in (2, 70):
                entries = [
                    finder.DSStoreEntry(f"folder-{i:03}", b"zzzz", b"blob", bytes([i]) * 2400)
                    for i in range(count)
                ]
                finder.write_store(target, entries)
                decoded = finder.records(Path(target).read_bytes())
                self.assertEqual(
                    [(e.filename, e.code, e.type, e.value) for e in decoded],
                    [(e.filename, e.code, e.type, e.value) for e in entries],
                )

    def test_parent_preferences_and_neighbor_records_survive(self):
        with tempfile.TemporaryDirectory() as root:
            parent = Path(root)
            project = parent / "proyecto-con-ñ"
            project.mkdir()
            ds = parent / ".DS_Store"
            opaque = b"opaque Finder data\x00\xff"
            original = [
                finder.DSStoreEntry("neighbor", b"cmmt", b"ustr", "Preserve me"),
                finder.DSStoreEntry("neighbor", b"zzzz", b"blob", opaque),
                finder.DSStoreEntry(project.name, b"bwsp", b"blob", b"window settings"),
            ]
            # Cross several B-tree pages, as a real version folder does.
            original.extend(
                finder.DSStoreEntry(f"neighbor-{i}", b"zzzz", b"blob", opaque * 20)
                for i in range(60)
            )
            finder.write_store(str(ds), original)
            finder.initialize(project)
            check(project)
            entries = {(e.filename, e.code): e for e in finder.records(ds.read_bytes())}
            for entry in original:
                self.assertEqual(entries[(entry.filename, entry.code)].value, entry.value)
            before = ds.read_bytes()
            finder.initialize(project)
            self.assertEqual(ds.read_bytes(), before)

    def test_user_sort_is_preserved_and_force_repairs_only_target(self):
        with tempfile.TemporaryDirectory() as root:
            project = Path(root) / "project"
            project.mkdir()
            finder.initialize(project)
            ds = project.parent / ".DS_Store"
            with finder.DSStore.open(str(ds), "r+") as store:
                store[project.name]["lsvp"] = ("blob", plistlib.dumps({"sortColumn": "dateModified"}))
            before = ds.read_bytes()
            finder.initialize(project)
            self.assertEqual(ds.read_bytes(), before)
            finder.initialize(project, force=True)
            check(project)

    def test_malformed_existing_store_is_never_replaced(self):
        with tempfile.TemporaryDirectory() as root:
            project = Path(root) / "project"
            project.mkdir()
            ds = project.parent / ".DS_Store"
            ds.write_bytes(b"existing unreadable metadata")
            with self.assertRaises(Exception):
                finder.initialize(project)
            self.assertEqual(ds.read_bytes(), b"existing unreadable metadata")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--set-date-added"]:
        directory = Path(sys.argv[2])
        target = directory.parent / ".DS_Store"
        entries = finder.records(target.read_bytes())
        for entry in entries:
            if entry.filename == directory.name and entry.code in finder.VIEW_CODES:
                settings = plistlib.loads(entry.value)
                settings["sortColumn"] = "dateAdded"
                entry.value = plistlib.dumps(settings, fmt=plistlib.FMT_BINARY)
        finder.write_store(str(target), entries)
    elif sys.argv[1:2] == ["--check"]:
        for directory in sys.argv[2:]:
            check(directory)
    else:
        unittest.main()
