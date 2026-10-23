"""Regenerate the portable Finder template; not needed at runtime.

Uses the bundled ds-store==1.3.3 (https://github.com/dmgbuild/ds_store).
List view settings follow https://github.com/dmgbuild/dmgbuild.
From the repository root: python3 tools/video-project-api/scripts/generate-finder-view.py
"""

from pathlib import Path
import plistlib
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src/assets/finder-metadata-vendor.zip"))

from ds_store import DSStore


columns = {
    name: {
        "index": index,
        "identifier": name,
        "width": width,
        "visible": visible,
        "ascending": ascending,
    }
    for index, (name, width, visible, ascending) in enumerate([
        ("name", 300, True, True),
        ("dateModified", 181, True, False),
        ("size", 97, True, False),
        ("kind", 115, True, True),
        ("dateCreated", 181, False, False),
        ("dateAdded", 181, False, False),
        ("dateLastOpened", 181, False, False),
        ("label", 100, False, True),
        ("version", 75, False, True),
        ("comments", 300, False, True),
    ])
}
settings = {
    "viewOptionsVersion": 1,
    "sortColumn": "name",
    "columns": columns,
    "textSize": 13.0,
    "iconSize": 16.0,
    "showIconPreview": True,
    "scrollPositionX": 0.0,
    "scrollPositionY": 0.0,
    "useRelativeDates": True,
    "calculateAllSizes": False,
}
template = (
    Path(__file__).resolve().parents[1]
    / "src/assets/finder-list-name-ascending.dsstore"
)
template.parent.mkdir(parents=True, exist_ok=True)
with DSStore.open(str(template), "w+") as store:
    store["."]["vSrn"] = ("long", 1)
    store["."]["vstl"] = ("type", b"Nlsv")
    store["."]["icvl"] = ("type", b"Nlsv")
    store["."]["lsvp"] = settings
    store["."]["lsvP"] = settings
    # Current Finder versions also save the column specification as an array.
    store["."]["lsvC"] = (
        "blob",
        plistlib.dumps(
            {**settings, "columns": list(columns.values())},
            fmt=plistlib.FMT_BINARY,
        ),
    )

# Verify the actual serialized records, independently of the copy operation.
with DSStore.open(str(template), "r") as store:
    assert store["."]["vstl"] == (b"type", b"Nlsv")
    for key in ("lsvp", "lsvP"):
        saved = store["."][key]
        assert saved["sortColumn"] == "name"
        assert saved["columns"]["name"]["ascending"] is True
        assert saved["columns"]["name"]["visible"] is True
print(f"Generated and verified {template}")
