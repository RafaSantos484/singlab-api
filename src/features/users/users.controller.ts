import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { UsersService, CreateUserResult } from './users.service';

/**
 * Users controller.
 * Handles HTTP requests related to user management.
 */
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Creates a new user account.
   *
   * Accepts a JSON body with name, e-mail and password.
   * A Firebase Auth account is created first; the profile document is then
   * written to Firestore using the Auth UID as document ID.
   * If the Firestore write fails the Auth account is automatically deleted.
   *
   * Example request:
   * ```
   * POST /users
   * Content-Type: application/json
   *
   * {
   *   "name": "Jane Doe",
   *   "email": "jane@example.com",
   *   "password": "S3cur3P@ss!"
   * }
   * ```
   *
   * @param body - Request body containing name, email and password
   * @returns Created user data (uid, name, email, createdAt)
   * @throws BadRequestException if body validation fails
   * @throws ConflictException if the e-mail is already registered
   * @throws HttpException for unexpected errors
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() body: Record<string, unknown>,
  ): Promise<CreateUserResult> {
    this.logger.debug(
      `User creation request for e-mail: ${String(body['email'])}`,
    );
    return this.usersService.createUser(body);
  }
}
