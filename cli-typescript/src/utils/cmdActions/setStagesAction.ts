import { encodeFunctionData, Hex } from 'viem';
import { ContractManager } from '../ContractManager';
import { ERC1155M_ABIS, ERC712M_ABIS } from '../../abis';
import { printTransactionHash, showError, showText } from '../display';
import {
  getERC1155ParsedStagesData,
  getERC721ParsedStagesData,
  processStages,
} from '../deployContract';
import { TOKEN_STANDARD } from '../constants';
import { ERC1155StageData, ERC721StageData } from '../types';
import { actionPresets } from './common';
import { isLegacyContract } from '../common';

export const setStagesAction = async (
  symbol: string,
  params: {
    stagesFile?: string;
  },
) => {
  try {
    const { cm, config, store } = await actionPresets(symbol);

    // Get contract version to determine which ABI to use
    const contractAddress = config.deployment?.contract_address as Hex;
    const versionInfo = await cm.getContractVersion(contractAddress);
    const version = versionInfo?.version;
    const isLegacy = isLegacyContract(version);

    console.log(
      `Contract version: ${version || 'unknown (assuming legacy)'}, using ${isLegacy ? 'legacy' : 'new'} ABI format`,
    );

    // Process stages data
    console.log('Processing stages data... this will take a moment.');
    const stagesData = await processStages({
      collectionFile: store.root,
      stagesFile: params.stagesFile,
      stagesJson: JSON.stringify(config.stages),
      tokenStandard: config.tokenStandard,
    });

    showText(`Setting stages for ${config.tokenStandard} collection...`);

    let txHash: Hex;

    if (config.tokenStandard === TOKEN_STANDARD.ERC721) {
      txHash = await sendERC721StagesTransaction(
        cm,
        contractAddress,
        getERC721ParsedStagesData(stagesData as ERC721StageData[], isLegacy),
        isLegacy,
      );
    } else if (config.tokenStandard === TOKEN_STANDARD.ERC1155) {
      txHash = await sendERC1155SetupTransaction(
        cm,
        contractAddress,
        getERC1155ParsedStagesData(stagesData as ERC1155StageData[], isLegacy),
        isLegacy,
      );
    } else {
      throw new Error('Unsupported token standard. Please check the config.');
    }

    printTransactionHash(txHash, config.chainId);
  } catch (error: any) {
    showError({ text: `Error setting stages: ${error.message}` });
  }
};

const sendERC721StagesTransaction = async (
  cm: ContractManager,
  contractAddress: Hex,
  stagesData: ReturnType<typeof getERC721ParsedStagesData>,
  isLegacy: boolean,
) => {
  // Choose the appropriate ABI based on version
  const abi = isLegacy ? ERC712M_ABIS.setStagesLegacy : ERC712M_ABIS.setStages;

  const args = stagesData.map((stage) => {
    if (isLegacy) {
      // Legacy format: [price, mintFee, walletLimit, merkleRoot, maxStageSupply, startTime, endTime]
      return {
        price: stage[0],
        mintFee: stage[1],
        walletLimit: stage[2],
        merkleRoot: stage[3],
        maxStageSupply: stage[4],
        startTimeUnixSeconds: stage[5],
        endTimeUnixSeconds: stage[6],
      } as {
        price: bigint;
        mintFee: bigint;
        walletLimit: number;
        merkleRoot: Hex;
        maxStageSupply: number;
        startTimeUnixSeconds: bigint;
        endTimeUnixSeconds: bigint;
      };
    } else {
      // New format: [price, walletLimit, merkleRoot, maxStageSupply, startTime, endTime]
      return {
        price: stage[0],
        walletLimit: stage[1],
        merkleRoot: stage[2],
        maxStageSupply: stage[3],
        startTimeUnixSeconds: stage[4],
        endTimeUnixSeconds: stage[5],
      } as {
        price: bigint;
        walletLimit: number;
        merkleRoot: Hex;
        maxStageSupply: number;
        startTimeUnixSeconds: bigint;
        endTimeUnixSeconds: bigint;
      };
    }
  });

  const data = encodeFunctionData({
    abi: [abi],
    functionName: abi.name,
    args: [args],
  });

  const txHash = await cm.sendTransaction({
    to: contractAddress,
    data,
  });

  const receipt = await cm.waitForTransactionReceipt(txHash);
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  return receipt.transactionHash;
};

const sendERC1155SetupTransaction = async (
  cm: ContractManager,
  contractAddress: Hex,
  stagesData: ReturnType<typeof getERC1155ParsedStagesData>,
  isLegacy: boolean,
) => {
  // Choose the appropriate ABI based on version
  const abi = isLegacy
    ? ERC1155M_ABIS.setStagesLegacy
    : ERC1155M_ABIS.setStages;

  const args = stagesData.map((stage) => {
    if (isLegacy) {
      // Legacy format: [price[], mintFee[], walletLimit[], merkleRoot[], maxStageSupply[], startTime, endTime]
      return {
        price: stage[0],
        mintFee: stage[1],
        walletLimit: stage[2],
        merkleRoot: stage[3],
        maxStageSupply: stage[4],
        startTimeUnixSeconds: stage[5],
        endTimeUnixSeconds: stage[6],
      } as {
        price: bigint[];
        mintFee: bigint[];
        walletLimit: number[];
        merkleRoot: `0x${string}`[];
        maxStageSupply: number[];
        startTimeUnixSeconds: bigint;
        endTimeUnixSeconds: bigint;
      };
    } else {
      // New format: [price[], walletLimit[], merkleRoot[], maxStageSupply[], startTime, endTime]
      return {
        price: stage[0],
        walletLimit: stage[1],
        merkleRoot: stage[2],
        maxStageSupply: stage[3],
        startTimeUnixSeconds: stage[4],
        endTimeUnixSeconds: stage[5],
      } as {
        price: bigint[];
        walletLimit: number[];
        merkleRoot: `0x${string}`[];
        maxStageSupply: number[];
        startTimeUnixSeconds: bigint;
        endTimeUnixSeconds: bigint;
      };
    }
  });

  const data = encodeFunctionData({
    abi: [abi],
    functionName: abi.name,
    args: [args],
  });

  const txHash = await cm.sendTransaction({
    to: contractAddress,
    data,
  });

  const receipt = await cm.waitForTransactionReceipt(txHash);
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  return receipt.transactionHash;
};

export default setStagesAction;
