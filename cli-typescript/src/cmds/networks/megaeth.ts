import { SUPPORTED_CHAINS } from '../../utils/constants';
import { createEvmCommand } from '../createCommand';
import { EvmPlatform } from '../../utils/evmUtils';
import { getSymbolFromChainId } from '../../utils/getters';

// Supported chain names
export enum MegaETHChains {
  MAINNET = 'mainnet',
}

// Chain ids by the chain names
export const megaethChainIdsByName = new Map([
  [MegaETHChains.MAINNET, SUPPORTED_CHAINS.MEGAETH],
]);

const megaethPlatform = new EvmPlatform(
  'MegaETH',
  getSymbolFromChainId(SUPPORTED_CHAINS.MEGAETH),
  megaethChainIdsByName,
  MegaETHChains.MAINNET,
);

export const megaeth = createEvmCommand({
  platform: megaethPlatform,
  commandAliases: [
    getSymbolFromChainId(SUPPORTED_CHAINS.MEGAETH).toLowerCase(),
    'mega',
  ],
});

export default megaeth;
