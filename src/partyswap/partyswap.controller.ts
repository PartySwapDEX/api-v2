import { Controller, Get } from '@nestjs/common';
import { request } from 'graphql-request';
import { AprService } from 'src/apr/apr.service';
import { ChainId, WAVAX_ADDRESS } from 'src/utils/constants';
import { getPair, graphUrl } from './graphql/queries';
import { PartySwapService } from './partyswap.service';

@Controller('partyswap/v1')
export class PartySwapController {
  constructor(
    private readonly partySwapService: PartySwapService,
    private readonly aprService: AprService,
  ) {}

  @Get('allPairs')
  async getAllPairsInfo(): Promise<any> {
    const pairAddresses = await this.partySwapService.getPairAddresses();

    const infoPerPair = await Promise.all(
      pairAddresses.map((pair) =>
        request(graphUrl, getPair, {
          pair,
        }),
      ),
    );

    const response = {};

    infoPerPair.forEach((info) => {
      const { pairDayDatas } = info;
      if (pairDayDatas && pairDayDatas[0]) {
        const {
          dailyVolumeToken0,
          dailyVolumeToken1,
          reserve0,
          reserve1,
          token0,
          token1,
        } = pairDayDatas[0];

        if (token0 && token1) {
          response[`${token0.id}_${token1.id}`] = {
            base_id: token0.id,
            base_name: token0.name,
            base_symbol: token0.symbol,
            quote_id: token1.id,
            quote_name: token1.name,
            quote_symbol: token1.symbol,
            last_price: reserve1 / reserve0,
            base_volume: dailyVolumeToken0,
            quote_volume: dailyVolumeToken1,
          };
        }
      }
    });

    return response;
  }

  @Get('yieldFarming')
  async getYieldFarmingInfo(): Promise<any> {
    let isAvaxPool;
    const wavax = WAVAX_ADDRESS[ChainId.AVALANCHE].toLowerCase();

    this.aprService.setChainId(ChainId.AVALANCHE);
    const base = {
      provider: 'PartySwap',
      provider_logo: 'https://partyswap.io/assets/img/favicon.png',
      provider_URL: 'partyswap.io',
      links: [
        {
          title: 'Discord',
          link: 'https://discord.gg/r9fTvqCfBw',
        },
        {
          title: 'Twitter',
          link: 'https://twitter.com/partyswapdex',
        },
        {
          title: 'Telegram',
          link: 'https://t.me/partyswap',
        },
        {
          title: 'Medium',
          link: 'https://partyswap-ex.medium.com/',
        },
      ],
    };

    const buildPoolUrl = ({
      token0,
      token1,
    }: {
      token0: string;
      token1: string;
    }) => {
      const baseurl = 'https://app.partyswap.io/#/party/';
      let basetoken, quote, version;
      version = 1;

      if (token0.toLowerCase() === wavax || token1.toLowerCase() === wavax) {
        basetoken = 'AVAX';
        if (token0.toLowerCase() === wavax) {
          quote = token1.toLowerCase();
        } else {
          quote = token0.toLowerCase();
        }
      } else {
        basetoken = token0.toLowerCase();
        quote = token1.toLowerCase();
      }

      return `${baseurl}${basetoken}/${quote}/${version}`;
    };

    const pairAddresses = await this.partySwapService.getPairAddresses();

    const poolsAddresses = (
      await Promise.all(
        pairAddresses.map(async (pair) => {
          return {
            pool: await this.partySwapService.getStakingRewardsAddress(pair),
            pair,
          };
        }),
      )
    ).filter(({ pool }) => pool !== '0x00');

    const avaxUsdt = await request(graphUrl, getPair, {
      pair: '0xF83575ddC6744c07Ca49a33f89E9581B9b20653E',
    });
    const { pairDayDatas: avaxUsdtInfo } = avaxUsdt;
    const { reserve0, reserve1 } = avaxUsdtInfo[0];
    const avaxUsdPrice = reserve1 / reserve0;

    const infoPerPair = await Promise.all(
      poolsAddresses.map(async ({ pair, pool }) => {
        const result = await request(graphUrl, getPair, {
          pair,
        });
        if (result) {
          const { pairDayDatas } = result;
          if (pairDayDatas && pairDayDatas[0]) {
            const { token0, token1 } = pairDayDatas[0];
            if (
              token0.id.toLowerCase() === wavax ||
              token1.id.toLowerCase() === wavax
            ) {
              isAvaxPool = true;
            } else {
              isAvaxPool = false;
            }
            const { name: basename, symbol: basesymbol, id: baseid } = token0;
            const {
              name: quotename,
              symbol: quotesymbol,
              id: quoteid,
            } = token1;

            const avaxStaked = isAvaxPool
              ? await this.partySwapService.calculteTotalStakedAmountInAvax(
                  pair,
                )
              : await this.partySwapService.calculateTotalStakedAmount(pool);

            const totalStaked = +avaxStaked * 1e-18 * avaxUsdPrice;

            return {
              name: `${basename}-${quotename}`,
              pair: `${basesymbol}-${quotesymbol}`,
              pairLink: buildPoolUrl({ token0: baseid, token1: quoteid }),
              logo: base.provider_logo,
              poolRewards: ['PARTY'],
              apr: (await this.aprService.getApr(pool)).toString(),
              totalStaked,
              pool,
            };
          }
        }

        return {
          pool,
        };
      }),
    );

    return {
      ...base,
      pools: infoPerPair.sort((a, b) => +b.totalStaked - +a.totalStaked),
    };
  }
}
