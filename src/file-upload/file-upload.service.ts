import { BadRequestException, Injectable } from '@nestjs/common';
import path, { join } from 'path';
import { promises as FileSystem } from 'fs';
import { FileUploadType } from './file-upload.type';

@Injectable()
export class FileUploadService {
  private readonly folder = 'uploads';

  async replaceFile(
    odlFileUrl: string,
    newFile: Express.Multer.File,
    subFolder: FileUploadType,
  ) {
    if (!odlFileUrl) return;

    const filename = this.getFilenameOnly(odlFileUrl);

    await this.deleteFile(odlFileUrl);

    return await this.uploadFile(newFile, subFolder, filename);
  }

  getFilenameOnly(url: string): string | null {
    try {
      // aba.png
      // aba
      const filename = new URL(url).pathname.split('/').pop();
      if (!filename) return null;

      return filename.split('.').slice(0, -1).join('.');
    } catch {
      return null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    subFolder: FileUploadType,
    filename?: string | null,
  ) {
    if (!file) throw new BadRequestException('Flile is required');
    // join file path to make a directory or check if exist or not
    // process.cwd() = root or current dir
    const uploadDirectory = join(process.cwd(), this.folder, 'user');
    // mkdir = create if not exist
    await FileSystem.mkdir(uploadDirectory, { recursive: true });
    // if no filename, generate random string as filename
    if (!filename) {
      const ext = path.extname(file.originalname).replace('.', '');
      filename = crypto.randomUUID() + `.${ext}`;
    } else {
      const ext = path.extname(file.originalname).replace('.', '');
      filename += `.${ext}`;
    }
    // create new file path to store file
    const filePath = join(uploadDirectory, filename);
    // save file to file path
    await FileSystem.writeFile(filePath, file.buffer);
    // url file path
    return process.env.BASE_URL + `/uploads/${subFolder}/` + filename;
  }

  async validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Flile is required');

    const allowMaxSize = 5120;
    const allowFileType = ['pdf', 'png', 'jpg'];

    const { size, mimetype } = file;

    if (size / 1024 > allowMaxSize) {
      throw new BadRequestException('File is not allow bigger than 5MB');
    }

    const isValidateMimeType = allowFileType.some((type) =>
      mimetype.includes(type),
    );
    if (!isValidateMimeType) {
      throw new BadRequestException(
        `File with this extension { ${mimetype} are not allow }`,
      );
    }

    await this.uploadFile(file, 'product');
  }

  async deleteFile(url: string) {
    try {
      const pathname = new URL(url).pathname;
      // "/uploads/product/abc.png"

      const filePath = path.join(process.cwd(), pathname);

      await FileSystem.unlink(filePath);
    } catch (err) {
      console.warn('Failed to delete file:', err);
    }
  }
}
