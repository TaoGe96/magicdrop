import {
  createPublicClient,
  Hex,
  http,
  PublicClient,
  Chain,
  TransactionReceipt,
  decodeEventLog,
  toEventSelector,
  encodeFunctionData,
  decodeFunctionResult,
  formatEther,
} from 'viem';
import {
  getSymbolFromChainId,
  getTransferValidatorAddress,
  getTransferValidatorListId,
  getViemChainByChainId,
  isTransferValidatorV5,
} from './getters';
import {
  ICREATOR_TOKEN_INTERFACE_ID,
  rpcUrls,
  SUPPORTED_CHAINS,
} from './constants';
import { collapseAddress, isValidEthereumAddress } from './common';
import {
  APPLY_LIST_TO_COLLECTION_ABI,
  APPLY_LIST_TO_COLLECTION_ABI_V5,
  IS_SETUP_LOCKED_ABI,
  MagicDropCloneFactoryAbis,
  MagicDropTokenImplRegistryAbis,
  NEW_CONTRACT_INITIALIZED_EVENT_ABI,
  NEW_CONTRACT_INITIALIZED_EVENT_ABI_LEGACY,
  SET_TRANSFER_VALIDATOR_ABI,
  SET_TRANSFERABLE_ABI,
  SUPPORTS_INTERFACE_ABI,
} from '../abis';
import { printTransactionHash, showText } from './display';
import { getMETurnkeyServiceClient } from './turnkey';

export class ContractManager {
  public client: PublicClient;
  public rpcUrl: string;
  public chain: Chain;

  constructor(
    public chainId: SUPPORTED_CHAINS,
    public signer: Hex,
    public symbol: string,
  ) {
    this.symbol = this.symbol.toLowerCase();
    this.rpcUrl = rpcUrls[this.chainId];
    this.chain = getViemChainByChainId(this.chainId);

    // Initialize viem client
    this.client = createPublicClient({
      chain: getViemChainByChainId(this.chainId),
      transport: http(this.rpcUrl),
    }) as PublicClient;

    if (!this.signer && !isValidEthereumAddress(this.signer)) {
      throw new Error(
        'ContractManager initialization failed! Signer is invalid.',
      );
    }

    this.signer = signer;
  }

  public async getDeploymentFee(
    registryAddress: Hex,
    standardId: number,
    implId: number,
  ): Promise<bigint> {
    try {
      const data = encodeFunctionData({
        abi: [MagicDropTokenImplRegistryAbis.getDeploymentFee],
        functionName: MagicDropTokenImplRegistryAbis.getDeploymentFee.name,
        args: [standardId, implId],
      });

      const result = await this.client.call({
        to: registryAddress,
        data,
      });

      showText('Fetching deployment fee...', '', false, false);

      if (!result.data) return BigInt(0);

      const decodedResult = decodeFunctionResult({
        abi: [MagicDropTokenImplRegistryAbis.getDeploymentFee],
        functionName: MagicDropTokenImplRegistryAbis.getDeploymentFee.name,
        data: result.data,
      });

      return decodedResult;
    } catch (error: any) {
      console.error('Error fetching deployment fee:', error.message);
      throw new Error('Failed to fetch deployment fee.');
    }
  }

  /**
   * Sends a transaction using METurnkeyServiceClient for signing.
   */
  public async sendTransaction({
    to,
    data,
    value = BigInt(0),
    gasLimit = BigInt(3_000_000),
  }: {
    to: Hex;
    data: Hex;
    value?: bigint;
    gasLimit?: bigint;
  }): Promise<Hex> {
    const meTurnkeyServiceClient = await getMETurnkeyServiceClient();
    return await meTurnkeyServiceClient.sendTransaction(this.symbol, {
      to,
      data,
      value,
      gasLimit,
      chainId: this.chainId,
    });
  }

  public async waitForTransactionReceipt(txHash: Hex) {
    return await this.client.waitForTransactionReceipt({ hash: txHash });
  }

  /**
   * returns the native balance of the signer
   * @returns The native balance of the signer in a human-readable format (e.g., ETH, MATIC).
   * @throws Error if the balance retrieval fails.
   */
  public async getSignerNativeBalance(): Promise<string> {
    try {
      // Fetch the balance of the signer
      const balance = await this.client.getBalance({
        address: this.signer,
      });

      // Convert the balance from Wei to Ether
      const humanReadableBalance = formatEther(balance);

      return humanReadableBalance;
    } catch (error: any) {
      console.error('Error checking signer native balance:', error.message);
      throw new Error('Failed to fetch signer native balance.');
    }
  }

  public async printSignerWithBalance() {
    if (!this.rpcUrl || !this.signer) {
      throw new Error('rpcUrl or signer is not set.');
    }

    const balance = await this.getSignerNativeBalance();
    const symbol = getSymbolFromChainId(this.chainId);

    console.log(`Signer: ${collapseAddress(this.signer)}`);
    console.log(`Balance: ${balance} ${symbol}`);
  }

  /**
   * Transfers native currency (ETH, MATIC, etc.) to a recipient address
   * @param to The recipient address
   * @param amount The amount to transfer in wei
   * @returns Transaction hash
   */
  public async transferNative({
    to,
    amount,
    gasLimit,
  }: {
    to: Hex;
    amount: bigint;
    gasLimit?: bigint;
  }): Promise<Hex> {
    const symbol = getSymbolFromChainId(this.chainId);
    showText(
      `Transferring ${formatEther(amount)} ${symbol} to ${collapseAddress(to)}...`,
    );

    // Check if sender has enough balance
    const balance = await this.client.getBalance({
      address: this.signer,
    });

    if (balance < amount) {
      throw new Error(
        `Insufficient balance. Available: ${formatEther(balance)} ${symbol}, Required: ${formatEther(amount)} ${symbol}`,
      );
    }

    const txHash = await this.sendTransaction({
      to,
      data: '0x',
      value: amount,
      gasLimit,
    });

    return txHash;
  }

  static getContractAddressFromLogs(logs: TransactionReceipt['logs']) {
    try {
      // Try the new event format first (version >= 1.0.2)
      const eventSelector = toEventSelector(
        NEW_CONTRACT_INITIALIZED_EVENT_ABI,
      ) as Hex;

      let log = logs.find((log) =>
        (log.topics as Hex[]).includes(eventSelector),
      );

      let eventAbi:
        | typeof NEW_CONTRACT_INITIALIZED_EVENT_ABI
        | typeof NEW_CONTRACT_INITIALIZED_EVENT_ABI_LEGACY =
        NEW_CONTRACT_INITIALIZED_EVENT_ABI;

      // If not found, try the legacy event format (version 1.0.0, 1.0.1)
      if (!log) {
        const legacyEventSelector = toEventSelector(
          NEW_CONTRACT_INITIALIZED_EVENT_ABI_LEGACY,
        ) as Hex;

        log = logs.find((log) =>
          (log.topics as Hex[]).includes(legacyEventSelector),
        );

        eventAbi = NEW_CONTRACT_INITIALIZED_EVENT_ABI_LEGACY;
      }

      if (!log) {
        throw new Error(
          'No matching log found for NewContractInitialized event (tried both new and legacy formats).',
        );
      }

      // Decode the event log with type assertion to handle union type
      const decodedLog = decodeEventLog({
        abi: [eventAbi] as any,
        data: log.data,
        topics: log.topics,
      }) as any;

      // Extract the contract address
      const contractAddress = decodedLog.args?.contractAddress as Hex | undefined;

      if (!contractAddress) {
        throw new Error('Contract address not found in decoded log.');
      }

      return contractAddress as Hex;
    } catch (error: any) {
      console.error(
        'Error decoding contract address from logs:',
        error.message,
      );
      throw new Error('Failed to extract contract address from logs.');
    }
  }

  /**
   * Checks if the contract supports the ICreatorToken interface.
   * @param contractAddress The address of the contract to check.
   * @returns A boolean indicating whether the contract supports ICreatorToken.
   */
  public async supportsICreatorToken(contractAddress: Hex): Promise<boolean> {
    try {
      console.log('Checking if contract supports ICreatorToken...');

      // Encode the function call for `supportsInterface(bytes4)`
      const data = encodeFunctionData({
        abi: [SUPPORTS_INTERFACE_ABI],
        functionName: SUPPORTS_INTERFACE_ABI.name,
        args: [ICREATOR_TOKEN_INTERFACE_ID],
      });

      // Call the contract using viem's `call` method
      const result = await this.client.call({
        to: contractAddress,
        data,
      });

      // Decode the result
      const decodedResult = decodeFunctionResult({
        abi: [SUPPORTS_INTERFACE_ABI],
        functionName: SUPPORTS_INTERFACE_ABI.name,
        data: result.data ?? '0x',
      }) as boolean;

      // Return the result as a boolean
      return decodedResult;
    } catch (error: any) {
      console.error('Error checking ICreatorToken support:', error.message);
      return false;
    }
  }

  public async createContract({
    collectionName,
    collectionSymbol,
    standardId,
    factoryAddress,
    implId,
    deploymentFee = BigInt(0),
  }: {
    collectionName: string;
    collectionSymbol: string;
    standardId: number;
    factoryAddress: Hex;
    implId: number;
    deploymentFee?: bigint;
  }) {
    // Implementation of createContract method
    const data = encodeFunctionData({
      abi: [MagicDropCloneFactoryAbis.createContract],
      functionName: MagicDropCloneFactoryAbis.createContract.name,
      args: [collectionName, collectionSymbol, standardId, this.signer, implId],
    });

    // Sign and send transaction
    const txHash = await this.sendTransaction({
      to: factoryAddress,
      data,
      value: deploymentFee,
    });

    const receipt = await this.waitForTransactionReceipt(txHash);

    return receipt;
  }

  /**
   * Sets the transfer validator for a contract.
   * @param contractAddress The address of the contract.
   * @throws Error if the operation fails.
   */
  public async setTransferValidator(contractAddress: Hex): Promise<Hex> {
    try {
      // Get the transfer validator address for the given chain ID
      const tfAddress = getTransferValidatorAddress(this.chainId);
      console.log(`Setting transfer validator to ${tfAddress}...`);

      const data = encodeFunctionData({
        abi: [SET_TRANSFER_VALIDATOR_ABI],
        functionName: SET_TRANSFER_VALIDATOR_ABI.name,
        args: [tfAddress],
      });

      const txHash = await this.sendTransaction({
        to: contractAddress,
        data,
      });

      printTransactionHash(txHash, this.chainId);

      console.log('Transfer validator set.');
      console.log('');

      return txHash;
    } catch (error: any) {
      console.error('Error setting transfer validator:', error.message);
      throw new Error('Failed to set transfer validator.');
    }
  }

  /**
   * Sets the transfer list for a contract.
   * @param contractAddress The address of the contract.
   * @throws Error if the operation fails.
   */
  public async setTransferList(contractAddress: Hex): Promise<Hex> {
    try {
      // Get the transfer validator list ID for the given chain ID
      const tfListId = getTransferValidatorListId(this.chainId);
      console.log(`Setting transfer list to list ID ${tfListId}...`);

      // Get the transfer validator address
      const tfAddress = getTransferValidatorAddress(this.chainId) as Hex;

      // Check if using Transfer Validator V5 (uses uint48 instead of uint120)
      const isV5 = isTransferValidatorV5(tfAddress);
      const abi = isV5
        ? APPLY_LIST_TO_COLLECTION_ABI_V5
        : APPLY_LIST_TO_COLLECTION_ABI;

      const data = encodeFunctionData({
        abi: [abi],
        functionName: abi.name,
        args: [contractAddress, BigInt(tfListId)],
      });

      const txHash = await this.sendTransaction({
        to: tfAddress,
        data,
      });

      printTransactionHash(txHash, this.chainId);

      console.log('Transfer list set.');
      console.log('');

      return txHash;
    } catch (error: any) {
      console.error('Error setting transfer list:', error.message);
      throw new Error('Failed to set transfer list.');
    }
  }

  /**
   * Freeze a contract.
   * @param contractAddress The address of the contract.
   */
  public async freezeThawContract(
    contractAddress: Hex,
    freeze: boolean,
  ): Promise<Hex> {
    console.log(
      `${freeze ? 'Freezing' : 'Thawing'} contract... this will take a moment.`,
    );

    const data = encodeFunctionData({
      abi: [SET_TRANSFERABLE_ABI],
      functionName: SET_TRANSFERABLE_ABI.name,
      args: [!freeze],
    });

    const txHash = await this.sendTransaction({
      to: contractAddress,
      data,
    });

    return txHash;
  }

  /**
   * Checks if the contract setup is locked.
   * @param contractAddress The address of the contract.
   * @throws Error if the contract setup is locked.
   */
  public async checkSetupLocked(contractAddress: Hex): Promise<void> {
    try {
      console.log('Checking if contract setup is locked...');

      const data = encodeFunctionData({
        abi: [IS_SETUP_LOCKED_ABI],
        functionName: IS_SETUP_LOCKED_ABI.name,
        args: [],
      });

      const result = await this.client.call({
        to: contractAddress,
        data,
      });

      const setupLocked = decodeFunctionResult({
        abi: [IS_SETUP_LOCKED_ABI],
        functionName: IS_SETUP_LOCKED_ABI.name,
        data: result.data ?? '0x',
      });

      // Check if the result indicates the setup is locked
      if (setupLocked) {
        showText(
          'This contract has already been setup. Please use other commands from the "Manage Contracts" menu to update the contract.',
        );
        process.exit(1);
      } else {
        console.log('Contract setup is not locked. Proceeding...');
      }
    } catch (error: any) {
      console.error('Error checking setup lock:', error.message);
      throw error;
    }
  }

  /**
   * Gets the current mint fee for a contract.
   * This feature is only available for contract version >= 1.0.2
   * @param contractAddress The address of the contract.
   * @returns The current mint fee in wei
   */
  public async getMintFee(contractAddress: Hex): Promise<bigint> {
    try {
      const getMintFeeAbi = {
        inputs: [],
        name: 'getMintFee',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      } as const;

      const data = encodeFunctionData({
        abi: [getMintFeeAbi],
        functionName: 'getMintFee',
        args: [],
      });

      const result = await this.client.call({
        to: contractAddress,
        data,
      });

      if (!result.data) {
        throw new Error('No data returned from getMintFee call');
      }

      const mintFee = decodeFunctionResult({
        abi: [getMintFeeAbi],
        functionName: 'getMintFee',
        data: result.data,
      });

      return mintFee;
    } catch (error: any) {
      console.error('Error getting mint fee:', error.message);
      throw new Error(
        'Failed to get mint fee. This feature is only available for contract version >= 1.0.2',
      );
    }
  }

  /**
   * Gets the contract name and version from the deployed contract.
   * @param contractAddress The address of the contract.
   * @returns An object containing contract name and version, or undefined if the call fails
   */
  public async getContractVersion(
    contractAddress: Hex,
  ): Promise<{ name: string; version: string } | undefined> {
    try {
      const contractNameAndVersionAbi = {
        inputs: [],
        name: 'contractNameAndVersion',
        outputs: [
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
          {
            internalType: 'string',
            name: '',
            type: 'string',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      } as const;

      const data = encodeFunctionData({
        abi: [contractNameAndVersionAbi],
        functionName: 'contractNameAndVersion',
        args: [],
      });

      const result = await this.client.call({
        to: contractAddress,
        data,
      });

      if (!result.data) {
        console.warn('No data returned from contractNameAndVersion call');
        return undefined;
      }

      const [name, version] = decodeFunctionResult({
        abi: [contractNameAndVersionAbi],
        functionName: 'contractNameAndVersion',
        data: result.data,
      }) as [string, string];

      return { name, version };
    } catch (error: any) {
      console.warn(
        'Could not get contract version, assuming legacy contract:',
        error.message,
      );
      return undefined;
    }
  }
}
