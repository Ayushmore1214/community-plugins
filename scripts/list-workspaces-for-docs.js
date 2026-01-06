#!/usr/bin/env node
/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import fs from 'fs-extra';
import { getPackages } from '@manypkg/get-packages';
import { resolve } from 'path';
import arrayToTable from 'array-to-table';
import * as url from 'url';
import * as codeowners from 'codeowners-utils';
import { listWorkspaces } from './list-workspaces.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function main(args) {
  const rootPath = resolve(__dirname, '..');
  const workspacePath = resolve(rootPath, 'workspaces');

  const reports = [];

  // --- summary counters ---
  let frontendCount = 0;
  let backendCount = 0;
  let workspacesWithoutOwners = 0;

  // Load CODEOWNERS
  const codeownersPath = resolve(rootPath, '.github', 'CODEOWNERS');
  const codeOwnerEntries = await codeowners.loadOwners(codeownersPath);

  const workspaces = await listWorkspaces();

  for (const workspace of workspaces) {
    const owners = codeOwnerEntries
      .filter(c => c.pattern === `/workspaces/${workspace}`)
      .flatMap(o => o.owners)
      .filter(o => o !== '@backstage/community-plugins-maintainers');

    if (owners.length === 0) {
      workspacesWithoutOwners += 1;
    }

    const formattedOwners =
      owners.length === 0
        ? '[@backstage/community-plugins-maintainers](https://github.com/orgs/backstage/teams/community-plugins-maintainers)'
        : owners
            .map(owner => {
              if (owner.includes('/')) {
                const [org, team] = owner.substring(1).split('/');
                return `[${owner}](https://github.com/orgs/${org}/teams/${team})`;
              }
              return `[${owner}](https://github.com/${owner.substring(1)})`;
            })
            .join(', ');

    const currentWorkspacePath = resolve(workspacePath, workspace);
    const { packages } = await getPackages(currentWorkspacePath);

    for (const pkg of packages) {
      if (pkg.packageJson.private) continue;

      const role = pkg.packageJson.backstage?.role;

      if (role === 'frontend-plugin') frontendCount += 1;
      if (role === 'backend-plugin') backendCount += 1;

      reports.push({
        workspace,
        owner: formattedOwners,
        package: pkg.packageJson.name,
        role,
        readme: `[README](${pkg.packageJson.repository.url}/blob/master/${pkg.packageJson.repository.directory}/README.md)`,
      });
    }
  }

  // --- print summary ---
  console.log('Summary');
  console.log('-------');
  console.log(`Total Workspaces: ${workspaces.length}`);
  console.log(`Public backend plugins: ${backendCount}`);
  console.log(`Public frontend plugins: ${frontendCount}`);
  console.log(
    `Workspaces without  CODEOWNERS: ${workspacesWithoutOwners}`,
  );
  console.log('');

  // --- existing behavior ---
  if (args.includes('--table')) {
    console.log(arrayToTable(reports));
  } else {
    console.log(reports);
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
