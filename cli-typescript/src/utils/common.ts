import chalk from 'chalk';
import { execSync } from 'child_process';
import { confirm } from '@inquirer/prompts';
import { isAddress } from 'viem';

export const confirmExit = async (): Promise<boolean> => {
  const answer = await confirm({
    message: 'Are you sure you want to exit?',
    default: false,
  });

  return answer;
};

/**
 * Validates if the input is an array of numbers.
 * @param value The value to validate.
 * @returns true if the value is an array of numbers, otherwise false.
 */
export const isArrayOfNumbers = (value: any): boolean => {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && !isNaN(item))
  );
};

/**
 * Helper function to execute shell commands.
 */
export const executeCommand = (command: string): string => {
  try {
    return execSync(command, { stdio: 'pipe' }).toString().trim();
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
};

/**
 * Decodes an address from a given chunk of data.
 * Extracts the last 40 characters (20 bytes) and prepends "0x".
 * @param chunk The input string containing the encoded address.
 * @returns The decoded Ethereum address.
 * @throws Error if the input is invalid or too short.
 */
export const decodeAddress = (chunk: string | null): `0x${string}` => {
  if (!chunk || chunk.length < 40) {
    throw new Error(
      `Unable to decode address from input (${chunk}): chunk must be at least 40 characters long.`,
    );
  }

  // Extract the last 40 characters (20 bytes for an Ethereum address)
  const address = chunk.slice(-40);

  // Prepend "0x" to make it a valid Ethereum address
  return `0x${address}`;
};

/**
 * Checks if a value is unset, null, or an empty string.
 * @param value The value to check.
 * @returns True if the value is null, undefined, or an empty string; otherwise, false.
 */
export const isUnsetOrNull = (value: string | null | undefined): boolean => {
  return value === null || value === undefined || value.trim() === '';
};

/**
 * Validates that an input value is not empty or undefined.
 * @param inputValue The value to validate.
 * @param inputName The name of the input field (used for error messages).
 * @throws Error if the input value is empty or undefined.
 */
export const checkInput = (
  inputValue: string | null | undefined,
  inputName: string,
): void => {
  if (!inputValue || inputValue.trim() === '') {
    throw new Error(`No input received for ${inputName}. Exiting...`);
  }
};

/**
 * Prompts the user to go to the main menu or exit the application.
 */
export const goToMainMenuOrExit = async (
  mainMenu: () => Promise<void>,
): Promise<void> => {
  const goToMainMenu = await confirm({
    message: 'Go to main menu?',
    default: true,
  });

  if (goToMainMenu) {
    console.clear();
    await mainMenu();
  } else {
    console.log(chalk.yellow('Exiting...'));
    process.exit(0);
  }
};

/**
 * Validates if a given string is a valid Ethereum address.
 * @param address The string to validate.
 * @returns True if the string is a valid Ethereum address, otherwise false.
 */
export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

/**
 * Formats an Ethereum address by showing the first 6 and last 4 characters, separated by "...".
 * @param address The Ethereum address to format.
 * @returns The collapsed address.
 */
export const collapseAddress = (address: string): string => {
  if (!isValidEthereumAddress(address)) {
    throw new Error('Invalid Ethereum address.');
  }

  const prefix = address.slice(0, 6);
  const suffix = address.slice(-4);
  return `${prefix}...${suffix}`;
};

export const verifyContractDeployment = (
  address: string | null | undefined,
): boolean => {
  if (!address || !isAddress(address)) {
    throw Error(
      'Invalid or missing collection address. Please deploy the contract first.',
    );
  }

  return true;
};

/**
 * Compares two semantic version strings (e.g., "1.2.3" vs "1.2.4")
 * @param version1 - First version string to compare
 * @param version2 - Second version string to compare
 * @returns {number}
 *  1 if version1 is greater than version2
 *  -1 if version1 is less than version2
 *  0 if versions are equal
 */
export function compareVersions(version1: string, version2: string): number {
  // Split version strings into arrays of numbers (e.g., "1.2.3" -> [1, 2, 3])
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  // Compare each part of the version numbers
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    // Use 0 as default if a version part doesn't exist
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    // Return early if we find a difference
    if (v1Part > v2Part) {
      return 1;
    }
    if (v1Part < v2Part) {
      return -1;
    }
  }

  // Versions are equal if we get here
  return 0;
}

/**
 * Checks if version1 is greater than or equal to version2
 * Handles undefined inputs safely by returning false
 * @param version1 - First version string to compare
 * @param version2 - Second version string to compare
 * @returns {boolean} true if version1 >= version2, false otherwise or if either input is undefined
 */
export function isVersionGreaterThanOrEqual(
  version1?: string,
  version2?: string,
): boolean {
  if (!version1 || !version2) {
    return false;
  }

  return compareVersions(version1, version2) >= 0;
}

/**
 * Checks if the contract version is a legacy version (1.0.0 or 1.0.1)
 * @param version - The contract version string
 * @returns {boolean} true if the version is 1.0.0 or 1.0.1, false otherwise
 */
export function isLegacyContract(version?: string): boolean {
  if (!version) {
    return false;
  }
  return version === '1.0.0' || version === '1.0.1';
}
