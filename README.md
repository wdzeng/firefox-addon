# Firefox Addon

This action publishes your firefox add-on to [Firefox Addons](https://addons.mozilla.org/) using the [addons.mozilla.org v5 API](https://addons-server.readthedocs.io/en/latest/topics/api/index.html).

This action can only publish new version of an existing add-on. Publishing a new add-on is not supported.

## Prepare

Followings items are required before publishing an add-on:

- An xpi (zip) file to be uploaded.
- A JWT issuer and secret.

If you have no JWT issuer and secret, go [here](https://addons.mozilla.org/en-US/developers/addon/api/key/) to generate an API credential.

## Usage

Unless otherwise noted with default value, all options are required.

- `addon-guid`: add-on guid.
- `xpi-path`: path to the xpi (or zip) file of your add-on generated in the previous workflow steps.
- `self-hosted` (boolean) whether the add-on should be self-hosted; default `false`.
- `jwt-issuer`: your jwt issuer.
- `jwt-secret`: your jwt secret.

The add-on guid should be the value at `browser_specific_settings.gecko.id` in manifest.json. It may be an email.

```yaml
steps:
  - uses: wdzeng/firefox-addon@v1
    with:
      guid: your-addon-guid
      xpi-path: your-addon.zip
      self-hosted: false
      jwt-issuer: ${{ secrets.FIREFOX_JWT_ISSUER }}
      jwt-secret: ${{ secrets.FIREFOX_JWT_SECRET }}
```

## References

- [External API](https://addons-server.readthedocs.io/en/latest/topics/api/index.html)
- [Add-ons](https://addons-server.readthedocs.io/en/latest/topics/api/addons.html)
- [Authentication (External)](https://addons-server.readthedocs.io/en/latest/topics/api/auth.html#create-a-jwt-for-each-request)
