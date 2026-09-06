import { Module } from '@nestjs/common';
import { AuthorsController } from './authors.controller';
import { PublicAuthorsController } from './public-authors.controller';
import { AuthorsService } from './authors.service';

@Module({
  controllers: [PublicAuthorsController, AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
