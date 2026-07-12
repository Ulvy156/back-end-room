import { Body, Controller, Param, Patch } from '@nestjs/common';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { LegalService } from 'src/legal/legal.service';
import { UpdateLegalDocumentDto } from 'src/legal/dto/update-legal-document.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/legal')
export class AdminLegalController {
  constructor(private readonly legalService: LegalService) {}

  @Patch(':slug')
  update(@Param('slug') slug: string, @Body() dto: UpdateLegalDocumentDto) {
    return this.legalService.updateDocument(slug, dto.content);
  }
}
