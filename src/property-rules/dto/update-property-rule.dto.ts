import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyRuleDto } from './create-property-rule.dto';

export class UpdatePropertyRuleDto extends PartialType(CreatePropertyRuleDto) {}
