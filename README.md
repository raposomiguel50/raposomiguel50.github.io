# Miguel's Game Dev Lab

Game ports, retro development and lessons from working with hardware.

[Visit the website](https://raposomiguel50.github.io/)

## Projects

**System Shock — Android:** an ARM64 port based on Shockolate, tested on the Retroid Pocket 5. Version 1.0.0 is available; users supply their own game data.

[Project](https://raposomiguel50.github.io/projects/system-shock-android/) · [Release](https://github.com/raposomiguel50/system-shock-android/releases/tag/v1.0.0) · [Source](https://github.com/raposomiguel50/system-shock-android)

**The Legend of Zelda: The Minish Cap — RG34XX:** a native muOS integration based on EstebanPdN's Project Picori-derived source. Integration patches and guides are public; there is no public game executable.

[Project](https://raposomiguel50.github.io/projects/minish-cap-rg34xx/) · [Source](https://github.com/raposomiguel50/minish-cap-rg34xx) · [Upstream](https://github.com/EstebanPdN/zelda-tmc-3ds)

## Site and documentation

This repository contains the GitHub Pages site. Each game's source and engineering records live in its own repository.

Product pages introduce the project and explain how to use it. Technical pages provide test conditions, source revisions and supporting records.

Write routine product facts directly. Keep source links where they help verification, credits where work is inherited, and formal citations where specific borrowed work requires attribution.

[Development method](https://raposomiguel50.github.io/method/) · [External coverage](https://raposomiguel50.github.io/coverage/) · [System Shock feedback](https://github.com/raposomiguel50/system-shock-android/issues/new/choose) · [Minish Cap feedback](https://github.com/raposomiguel50/minish-cap-rg34xx/issues)

Proprietary game data is not distributed by this site.

## Check the site

Run `python3 tools/check_site.py` from this repository. It checks local links, fragment targets, duplicate IDs, page titles, main headings and skip links without network access.

The **Site quality** workflow runs the same checks on pushes and pull requests. Deployment is a separate workflow; a build result does not replace a page check.

Test narrow-screen layout and keyboard navigation after changing navigation or styles. Keep knowledge-record identifiers consistent with the project repositories.
