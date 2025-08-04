https://github.com/backstage/community-plugins/issues/4828https://github.com/backstage/community-plugins/issues/4828https://github.com/backstage/community-plugins/issues/4828


# ServiceNow Frontend Plugin

This is the frontend implementation of the ServiceNow plugin for Backstage.

It is responsible for rendering the ServiceNow tab content, fetching incident data, and integrating with Backstage's dynamic plugin system.


## Getting Started

1. **Install dependencies**

   From this directory, install the necessary dependencies:

   ```
   yarn install
   ```

2. **Run the development app**

   Start the example app:

   ```
   yarn start
   ```

   After starting, you can access the plugin at:  
   http://localhost:3000/servicenow

## Dynamic Plugin Configuration

To use or customize this plugin in a Backstage environment that supports dynamic plugins (such as RHDH), add entries to your `dynamic-plugins.yaml` file. Here is an example configuration:

```
dynamicPlugins:
  includes:
    - package: '@backstage/plugin-servicenow'
      disabled: false
      mountPoints:
        - mountPoint: entity.page.tabs
          config:
            label: 'ServiceNow Tickets'
            icon: 'incident'
            isMyProfile: true
```

- **mountPoint:** Specifies where in the Backstage UI the plugin tab will appear.
- **label/icon:** Sets the appearance of the tab.
- **isMyProfile:** If true, the tab will show only tickets assigned to the currently logged-in user.

## Identity Handling

When running in a production environment or with dynamic plugins enabled, the "My ServiceNow Tickets" tab will show incidents relevant to the logged-in user. When running in the local development app, user-specific filtering may not be available, and all incidents may be shown.

## Development Notes

This plugin is already included in the development app provided in this repository, so you can use the steps above for immediate testing. For integration into your own Backstage instance, consult Backstage documentation for dynamic plugin configuration options.

## Frontend Configuration

This plugin supports dynamic mounting via `dynamic-plugins.yaml`.
Please refer to the main plugin [README](../README.md) for complete instructions on:

- Adding dynamic mount points
- Configuring tabs
- Using the `isMyProfile` condition on mount point configuration

