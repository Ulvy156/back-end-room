import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'prisma/generated/enums';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // [USER] Submit a bug report or suggestion
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour — prevents spam
  @Post()
  create(@Body() dto: CreateFeedbackDto, @Req() req: AuthenticatedRequest) {
    return this.feedbackService.create(req.user.id, dto);
  }

  // [ADMIN] View all submitted feedback
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.feedbackService.findAll();
  }
}
