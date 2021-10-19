import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { HttpService, Injectable } from '@nestjs/common';
import {
  ChainId,
  ERC20_ABI,
  FACTORY_ABI,
  FACTORY_ADDRESS,
  LIQUIDITY_POOL_MANAGER_ABI,
  LIQUIDITY_POOL_MANAGER_ADDRESS,
  PAIR_ABI,
  PARTY_ADDRESS,
  RPC_URL,
  WAVAX_ADDRESS,
  WAVAX_PARTY_ADDRESS,
} from 'src/utils/constants';

@Injectable()
export class PartySwapService {
  constructor(private httpService: HttpService) {}

  async getPairAddresses() {
    const pairsCount = await this.getPairsCount();
    const pairAddressHolder = [];
    for (let i = 0; i <= pairsCount - 1; i++) {
      pairAddressHolder.push({});
    }

    const pairAddresses = await Promise.all(
      pairAddressHolder.map(async (holder, index) => {
        return await this.getPairAt(index);
      }),
    );

    return pairAddresses;
  }

  async getPairAt(index: string | number) {
    const {
      data: { result },
    } = await this.call(
      FACTORY_ABI,
      FACTORY_ADDRESS[ChainId.AVALANCHE],
      'allPairs',
      [index.toString()],
    );

    return BigNumber.from(result).toHexString();
  }

  async getPairsCount() {
    const {
      data: { result },
    } = await this.call(
      FACTORY_ABI,
      FACTORY_ADDRESS[ChainId.AVALANCHE],
      'allPairsLength ',
      [],
    );

    return BigNumber.from(result).toNumber();
  }

  async getStakingRewardsAddress(pair: string) {
    const {
      data: { result },
    } = await this.call(
      LIQUIDITY_POOL_MANAGER_ABI,
      LIQUIDITY_POOL_MANAGER_ADDRESS[ChainId.AVALANCHE],
      'stakes',
      [pair],
    );

    return BigNumber.from(result).toHexString();
  }

  async getPinataTotalSupply(stakingAddress) {
    try {
      const {
        data: { result },
      } = await this.call(PAIR_ABI, stakingAddress, 'balanceOf', []);

      return BigNumber.from(result).toString();
    } catch (error) {
      console.log(error);
    }
  }

  async calculteTotalStakedAmountInAvax(pairAddress: string) {
    try {
      const {
        data: { result },
      } = await this.call(
        ERC20_ABI,
        WAVAX_ADDRESS[ChainId.AVALANCHE],
        'balanceOf',
        [pairAddress],
      );

      const reserveWavax = BigNumber.from(result);
      const totalStakedAvax = reserveWavax.mul(BigNumber.from(2));
      return totalStakedAvax.toString();
    } catch (error) {
      console.log(error);
    }
  }

  async calculateTotalStakedAmount(pool: string) {
    const totalSupply = await this.getPinataTotalSupply(pool);
    const {
      data: { result: wavaxReserve },
    } = await this.call(
      ERC20_ABI,
      WAVAX_ADDRESS[ChainId.AVALANCHE],
      'balanceOf',
      [WAVAX_PARTY_ADDRESS[ChainId.AVALANCHE]],
    );

    const {
      data: { result: partyReserve },
    } = await this.call(
      ERC20_ABI,
      PARTY_ADDRESS[ChainId.AVALANCHE],
      'balanceOf',
      [WAVAX_PARTY_ADDRESS[ChainId.AVALANCHE]],
    );

    const bWavaxReserve = BigNumber.from(wavaxReserve);
    const bPartyReserve = BigNumber.from(partyReserve);
    const ratio = BigNumber.from(bWavaxReserve.div(bPartyReserve));

    const bTotalSupply = BigNumber.from(totalSupply);
    return bTotalSupply.mul(ratio).toString();
  }

  call(
    abi: any[],
    toAddress: string,
    functionName: string,
    functionData: any[],
  ) {
    const iface = new Interface(abi);

    return this.httpService
      .post(RPC_URL[43114], {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: toAddress,
            data: iface.encodeFunctionData(functionName, functionData),
          },
          'latest',
        ],
      })
      .toPromise();
  }
}
