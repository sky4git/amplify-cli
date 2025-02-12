import * as fs from 'fs-extra';
import sequential from 'promise-sequential';
import {
  pathManager, stateManager, $TSContext, $TSAny,
} from 'amplify-cli-core';
import { getFrontendPlugins } from '../extensions/amplify-helpers/get-frontend-plugins';
import { getProviderPlugins } from '../extensions/amplify-helpers/get-provider-plugins';
import { insertAmplifyIgnore } from '../extensions/amplify-helpers/git-manager';

/**
 * Initializes amplify project files
 */
export const generateFiles = async (context: $TSContext): Promise<$TSContext> => {
  const { projectPath } = context.exeInfo.localEnvInfo;

  const amplifyDirPath = pathManager.getAmplifyDirPath(projectPath);
  const dotConfigDirPath = pathManager.getDotConfigDirPath(projectPath);
  const backendDirPath = pathManager.getBackendDirPath(projectPath);
  const currentBackendDirPath = pathManager.getCurrentCloudBackendDirPath(projectPath);

  fs.ensureDirSync(amplifyDirPath);
  fs.ensureDirSync(dotConfigDirPath);
  fs.ensureDirSync(backendDirPath);
  fs.ensureDirSync(currentBackendDirPath);

  const providerPlugins = getProviderPlugins(context);
  const providerOnSuccessTasks: (() => Promise<$TSAny>)[] = [];

  const frontendPlugins = getFrontendPlugins(context);
  // eslint-disable-next-line
  const frontendModule = require(frontendPlugins[context.exeInfo.projectConfig.frontend]);

  await frontendModule.onInitSuccessful(context);

  generateLocalRuntimeFiles(context);
  generateNonRuntimeFiles(context);

  context.exeInfo.projectConfig.providers.forEach(provider => {
    // eslint-disable-next-line
    const providerModule = require(providerPlugins[provider]);
    providerOnSuccessTasks.push(() => providerModule.onInitSuccessful(context));
  });

  await sequential(providerOnSuccessTasks);

  const currentAmplifyMeta = stateManager.getCurrentMeta(undefined, {
    throwIfNotExist: false,
    default: {},
  });

  await context.amplify.onCategoryOutputsChange(context, currentAmplifyMeta);

  return context;
};

const generateLocalRuntimeFiles = (context: $TSContext): void => {
  generateLocalEnvInfoFile(context);
};

const generateLocalEnvInfoFile = (context: $TSContext): void => {
  const { projectPath } = context.exeInfo.localEnvInfo;

  stateManager.setLocalEnvInfo(projectPath, context.exeInfo.localEnvInfo);
};

const generateNonRuntimeFiles = (context: $TSContext): void => {
  generateProjectConfigFile(context);
  generateBackendConfigFile(context);
  generateTeamProviderInfoFile(context);
  generateGitIgnoreFile(context);
};

const generateProjectConfigFile = (context: $TSContext): void => {
  if (context.exeInfo.isNewProject || context.exeInfo.existingLocalEnvInfo?.noUpdateBackend) {
    const { projectPath } = context.exeInfo.localEnvInfo;

    stateManager.setProjectConfig(projectPath, context.exeInfo.projectConfig);
  }
};

/**
 * Write the initial TPI file to disk
 *
 * @deprecated Still creating the TPI file for now, but this will go away in the future
 */
const generateTeamProviderInfoFile = (context: $TSContext): $TSAny => {
  const { projectPath } = context.exeInfo.localEnvInfo;
  const { teamProviderInfo } = context.exeInfo;

  stateManager.setTeamProviderInfo(projectPath, teamProviderInfo);
  return undefined;
};

const generateBackendConfigFile = (context: $TSContext): void => {
  const { projectPath } = context.exeInfo.localEnvInfo;

  if (!stateManager.backendConfigFileExists(projectPath)) {
    stateManager.setBackendConfig(projectPath, {});
  }
};

const generateGitIgnoreFile = (context: $TSContext): void => {
  if (context.exeInfo.isNewProject) {
    const { projectPath } = context.exeInfo.localEnvInfo;

    const gitIgnoreFilePath = pathManager.getGitIgnoreFilePath(projectPath);

    insertAmplifyIgnore(gitIgnoreFilePath);
  }
};
