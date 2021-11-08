import { BigNumber } from '@ethersproject/bignumber';
import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { PARTY_ADDRESS, TREASURY_VESTER_ADDRESS } from 'src/utils/constants';
import { PartyService } from './party.service';

@Controller('party')
export class PartyController {
  constructor(private readonly partyService: PartyService) { }

  chainId = 43114;

  @Get('totalSupply')
  async getTotalSupply(): Promise<string> {
    this.partyService.setChainId(this.chainId);
    const totalSupply = await this.partyService.getTotalSupply(
      PARTY_ADDRESS[this.chainId],
    );
    return totalSupply.toString();
  }

  @Get('circulating')
  async getCirculating(@Req() request: Request): Promise<string> {
    const { query: { asUint256 } } = request;
    this.partyService.setChainId(this.chainId);
    const totalSupply = await this.partyService.getTotalSupply(
      PARTY_ADDRESS[this.chainId],
    );
    return totalSupply
      .sub(
        await this.partyService.getPNGBalance(
          TREASURY_VESTER_ADDRESS[this.chainId],
        ),
      )
      .sub(
        await this.partyService.getPNGBalance(
          '0xE2fE530C047f2d85298b07D9333C05737f1435fB', // Lock account for treasury
        ),
      )
      .sub(
        await this.partyService.getPNGBalance(
          '0x81b42dF04Bfd9329Ab897de2aE1b2543d68209Ce', // Genesis Address
        ),
      )
      .div(BigNumber.from(asUint256 ? "1" : "10").pow("18"))
      .toString();
  }

  @Get('jacuzzi')
  async getJacuzziStats(): Promise<any> {
    this.partyService.setChainId(this.chainId);
    return this.partyService.getJacuzziStats();
  }
}
