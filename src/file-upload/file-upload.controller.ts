import {
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('file-upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Get('/file-name')
  getFilenameOnly(@Query('url') url: string) {
    return this.fileUploadService.getFilenameOnly(url);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('url') url: string,
  ) {
    await this.fileUploadService.uploadFile(file, 'user', url);
  }

  @Post('/validate-file')
  @UseInterceptors(FileInterceptor('file'))
  validateFile(@UploadedFile() file: Express.Multer.File) {
    this.fileUploadService.validateFile(file);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  async replaceFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('url') url: string,
  ) {
    await this.fileUploadService.replaceFile(url, file, 'user');
  }
}
