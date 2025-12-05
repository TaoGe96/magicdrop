import { encodeFunctionData, Hex, parseEther } from 'viem';
import { ContractManager } from '../ContractManager';
import { printTransactionHash, showError, showText } from '../display';
import { actionPresets } from './common';

/**
 * Sets the mint fee for a collection contract.
 * This feature is only available for contract version >= 1.0.2
 * @param symbol - The collection symbol
 * @param params - Parameters including the new mint fee in ETH
 */
export const setMintFeeAction = async (
  symbol: string,
  params: {
    mintFee: string;
  },
) => {
  try {
    const { cm, config } = await actionPresets(symbol);

    const contractAddress = config.deployment?.contract_address as Hex;

    if (!contractAddress) {
      throw new Error(
        'Contract address not found. Please deploy the contract first.',
      );
    }

    // Get current mint fee
    const currentMintFee = await cm.getMintFee(contractAddress);
    showText(
      `Current mint fee: ${currentMintFee} wei (${Number(currentMintFee) / 1e18} ETH)`,
    );

    // Parse new mint fee
    const newMintFee = parseEther(params.mintFee);
    showText(
      `Setting new mint fee to: ${newMintFee} wei (${params.mintFee} ETH)`,
    );

    await cm.printSignerWithBalance();

    // Send transaction
    const txHash = await sendSetMintFeeTransaction(
      cm,
      contractAddress,
      newMintFee,
    );

    printTransactionHash(txHash, config.chainId);
    showText('Mint fee updated successfully!');
  } catch (error: any) {
    showError({ text: `Error setting mint fee: ${error.message}` });
  }
};

/**
 * Sends the setMintFee transaction to the contract
 * @param cm - Contract manager instance
 * @param contractAddress - The contract address
 * @param mintFee - The new mint fee in wei
 * @returns The transaction hash
 */
const sendSetMintFeeTransaction = async (
  cm: ContractManager,
  contractAddress: Hex,
  mintFee: bigint,
): Promise<Hex> => {
  const setMintFeeAbi = {
    inputs: [
      {
        internalType: 'uint256',
        name: 'mintFee',
        type: 'uint256',
      },
    ],
    name: 'setMintFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  } as const;

  const data = encodeFunctionData({
    abi: [setMintFeeAbi],
    functionName: 'setMintFee',
    args: [mintFee],
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

export default setMintFeeAction;

