import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from 'prisma/generated/enums';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateFeedbackDto, @Req() req: AuthenticatedRequest) {
    return this.feedbackService.create(req.user.id, dto);
  }
}
