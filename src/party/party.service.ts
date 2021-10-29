import { HttpService, Injectable } from '@nestjs/common';
import { BigNumber } from '@ethersproject/bignumber';
import { Interface } from '@ethersproject/abi';
import { hexStripZeros, hexZeroPad } from '@ethersproject/bytes';
import {
  RPC_URL,
  ERC20_ABI,
  STAKING_REWARDS_ABI,
  PAIR_ABI,
  PARTY_ADDRESS,
  JACUZZI_ADDRESS,
  PARTY_STABLE_ADDRESS,
  STABLE_ADDRESS,
  WAVAX_PARTY_ADDRESS,
  WAVAX_ADDRESS,
} from '../utils/constants';

@Injectable()
export class PartyService {
  constructor(private httpService: HttpService) {}
  private chainId: number;

  setChainId(chainId: number) {
    this.chainId = chainId;
  }

  normalizeAddress(address: string) {
    return hexZeroPad(hexStripZeros(address), 20);
  }

  async getStakingTokenAddress(address: string) {
    const {
      data: { result },
    } = await this.call(STAKING_REWARDS_ABI, address, 'stakingToken', []);
    return this.normalizeAddress(result);
  }

  async getRewardRate(address: string) {
    const {
      data: { result },
    } = await this.call(STAKING_REWARDS_ABI, address, 'rewardRate', []);

    return BigNumber.from(result);
  }

  getPNGBalance(address: string) {
    return this.getBalance(PARTY_ADDRESS[this.chainId], address);
  }

  async getTotalSupply(address: string) {
    const {
      data: { result },
    } = await this.call(ERC20_ABI, address, 'totalSupply', []);

    return BigNumber.from(result);
  }

  async getPoolTokens(address: string) {
    const [token0, token1] = await Promise.all([
      this.call(PAIR_ABI, address, 'token0', []),
      this.call(PAIR_ABI, address, 'token1', []),
    ]);

    return [
      this.normalizeAddress(token0.data.result),
      this.normalizeAddress(token1.data.result),
    ];
  }

  async getBalance(erc20: string, address: string) {
    const {
      data: { result },
    } = await this.call(ERC20_ABI, erc20, 'balanceOf', [address]);

    return BigNumber.from(result);
  }

  async getJacuzziStats() {
    const [
      totalPartyInJacuzzi,
      pooledStable,
      pooledPartyInStable,
      pooledAvax,
      pooledPartyInAvax,
    ] = await Promise.all([
      this.getPNGBalance(JACUZZI_ADDRESS[this.chainId]),
      this.getBalance(
        STABLE_ADDRESS[this.chainId],
        PARTY_STABLE_ADDRESS[this.chainId],
      ),
      this.getBalance(
        PARTY_ADDRESS[this.chainId],
        PARTY_STABLE_ADDRESS[this.chainId],
      ),
      this.getBalance(
        WAVAX_ADDRESS[this.chainId],
        WAVAX_PARTY_ADDRESS[this.chainId],
      ),
      this.getBalance(
        PARTY_ADDRESS[this.chainId],
        WAVAX_PARTY_ADDRESS[this.chainId],
      ),
    ]);

    const totalPartyInJacuzziWAVAX = totalPartyInJacuzzi
      .mul(pooledAvax)
      .div(pooledPartyInAvax);
    const totalPartyInJacuzziUSD = totalPartyInJacuzzi
      .mul(pooledStable)
      .div(pooledPartyInStable);

    return {
      totalPartyInJacuzzi: totalPartyInJacuzzi.toString(),
      totalPartyInJacuzziUSD: totalPartyInJacuzziUSD.toString(),
      totalPartyInJacuzziWAVAX: totalPartyInJacuzziWAVAX.toString(),
    };
  }

  call(
    abi: any[],
    toAddress: string,
    functionName: string,
    functionData: any[],
  ) {
    const iface = new Interface(abi);

    return this.httpService
      .post(RPC_URL[this.chainId], {
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
