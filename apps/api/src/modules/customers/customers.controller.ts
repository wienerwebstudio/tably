import { Controller, Delete, Get, Header, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { consentUpdateSchema, customerCreateSchema, customerListQuerySchema, customerUpdateSchema } from '@tapperl/types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { Can, Tenant } from '../../common/guards';
import type { TenantContext } from '../../common/auth.types';
import { CustomersService } from './customers.service';

@ApiTags('Kunden')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Can('customers.read')
  list(@Tenant() ctx: TenantContext, @ZQuery(customerListQuerySchema) query: z.infer<typeof customerListQuerySchema>) {
    return this.customers.list(ctx, query);
  }

  @Get('export.csv')
  @Can('customers.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="kunden.csv"')
  exportCsv(@Tenant() ctx: TenantContext) {
    return this.customers.exportCsv(ctx);
  }

  @Post()
  @Can('customers.manage')
  @ApiZodBody(customerCreateSchema)
  create(@Tenant() ctx: TenantContext, @ZBody(customerCreateSchema) body: z.infer<typeof customerCreateSchema>) {
    return this.customers.create(ctx, body);
  }

  @Get(':id')
  @Can('customers.read')
  get(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.customers.get(ctx, id);
  }

  @Patch(':id')
  @Can('customers.manage')
  @ApiZodBody(customerUpdateSchema)
  update(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(customerUpdateSchema) body: z.infer<typeof customerUpdateSchema>) {
    return this.customers.update(ctx, id, body);
  }

  @Put(':id/consents')
  @Can('customers.manage')
  setConsent(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(consentUpdateSchema) body: z.infer<typeof consentUpdateSchema>) {
    return this.customers.setConsent(ctx, id, body.type, body.granted);
  }

  @Get(':id/export')
  @Can('customers.export')
  export(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.customers.export(ctx, id);
  }

  @Delete(':id')
  @Can('customers.export')
  async remove(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    await this.customers.remove(ctx, id);
    return { ok: true };
  }
}
