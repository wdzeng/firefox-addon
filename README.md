# Firefox Addon

[![version](https://img.shields.io/github/v/release/wdzeng/firefox-addon)](https://github.com/wdzeng/firefox-addon/releases/latest)
[![license](https://img.shields.io/github/license/wdzeng/firefox-addon?color=red)](https://github.com/wdzeng/firefox-addon/blob/main/LICENSE)

This action publishes your Firefox add-on to [Firefox Addons](https://addons.mozilla.org/) using the
[addons.mozilla.org API v5](https://addons-server.readthedocs.io/en/latest/topics/api/index.html).

This action can only publish new version of an existing add-on. Publishing a new add-on is not
supported.

## Prerequisites

Followings items are required before publishing an add-on:

- An xpi (zip) file to be uploaded.
- A JWT issuer and secret. If you do not have a JWT issuer or secret, go [here](https://addons.mozilla.org/en-US/developers/addon/api/key/)
  to generate an API credential.

## Usage

- `addon-guid`: (required) add-on's GUID; this value should be the value at
  `browser_specific_settings.gecko.id` in manifest.json; it may be an email or something like
  `{xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx}`.
- `jwt-issuer`: (required) your jwt issuer.
- `jwt-secret`: (required) your jwt secret.
- `xpi-path`: (required) path (or a glob pattern) to the xpi (zip) file of your add-on generated in
   the previous workflow steps; must end with either `.zip`, `.xpi`, or `.crx`; if glob pattern then
   it must match exactly one file.
- `approval-notes`: (optional): a secret text to Mozilla reviewers.
- `self-hosted` (optional) whether the add-on should be self-hosted; default `false`.
- `source-file-path` (optional) path (or a glob pattern) to source code archive; must end with
   either `.zip`, `.tar.gz`, `.tgz` or `.tar.bz2`; if glob pattern then it must match exactly one
   file.

Example workflow:

```yaml
steps:
  - uses: wdzeng/firefox-addon@v1
    with:
      addon-guid: your-addon's-guid
      xpi-path: your-addon.zip
      self-hosted: false
      jwt-issuer: ${{ secrets.FIREFOX_JWT_ISSUER }}
      jwt-secret: ${{ secrets.FIREFOX_JWT_SECRET }}
```

## References

- [External API](https://addons-server.readthedocs.io/en/latest/topics/api/index.html)
- [Add-ons](https://mozilla.github.io/addons-server/topics/api/addons.html)
- [Authentication (External)](https://addons-server.readthedocs.io/en/latest/topics/api/auth.html#create-a-jwt-for-each-request)

## Sister Actions

- [Edge Add-on Action](https://github.com/wdzeng/edge-addon)
- [Chrome Extension Action](https://github.com/wdzeng/chrome-extension)
