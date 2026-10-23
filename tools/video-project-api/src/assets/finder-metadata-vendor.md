# Finder metadata support

`finder-metadata-vendor.zip` contains unmodified Python sources from these PyPI
packages, together with their metadata and MIT licenses:

- `ds-store==1.3.3`: https://github.com/dmgbuild/ds_store
- `mac-alias==2.2.3`: https://github.com/dmgbuild/mac_alias

The archive can be inspected with `unzip -l`. It includes only Python source and
license/metadata files, with no native code. It is bundled so macOS project
creation never downloads or installs packages. `finder-view.py` uses Python 3.10+
(`VIDEO_FINDER_PYTHON`, an installed Homebrew Python, or `python3` from `PATH`);
other platforms do not run it.

To rebuild, install those exact versions into a temporary directory and zip the
packages' `.py` files, each distribution's `METADATA` and `licenses/LICENSE`.
