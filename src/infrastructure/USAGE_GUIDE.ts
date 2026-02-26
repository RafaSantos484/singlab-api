/**
 * USAGE GUIDE - Complete Examples for Firestore Repository Pattern
 *
 * This file demonstrates best practices and real-world examples
 * for implementing domain-driven repository access to Firestore.
 */

/**
 * STEP 1: Define Domain Entities
 * ==============================
 *
 * Keep domain entities free of persistence/framework concerns.
 * They represent business logic and validation rules.
 */

// Example: Audio upload domain entity
export interface AudioUpload {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  gcsPath?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * STEP 2: Create Persistence Model
 * ==================================
 *
 * Represents how data is stored in Firestore.
 * Timestamps and database-specific concerns go here.
 */

import * as admin from 'firebase-admin';

export interface AudioUploadDocument {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  gcsPath?: string;
  errorMessage?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * STEP 3: Create a Mapper
 * =======================
 *
 * Maps between domain entities and persistence models.
 * Keeps domain logic separate from storage concerns.
 */

import { BaseMapper } from '../infrastructure';

export class AudioUploadMapper extends BaseMapper<
  AudioUpload,
  AudioUploadDocument
> {
  toDomain(raw: AudioUploadDocument): AudioUpload {
    return {
      id: raw.id,
      userId: raw.userId,
      filename: raw.filename,
      originalName: raw.originalName,
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes,
      status: raw.status,
      gcsPath: raw.gcsPath,
      errorMessage: raw.errorMessage,
      createdAt: raw.createdAt.toDate(),
      updatedAt: raw.updatedAt.toDate(),
    };
  }

  toPersistence(domain: AudioUpload): AudioUploadDocument {
    return {
      id: domain.id,
      userId: domain.userId,
      filename: domain.filename,
      originalName: domain.originalName,
      mimeType: domain.mimeType,
      sizeBytes: domain.sizeBytes,
      status: domain.status,
      gcsPath: domain.gcsPath,
      errorMessage: domain.errorMessage,
      createdAt: admin.firestore.Timestamp.fromDate(domain.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(domain.updatedAt),
    };
  }
}

/**
 * STEP 4: Create a Domain-Specific Repository
 * =============================================
 *
 * Extends FirestoreRepository with domain-specific queries.
 * Each method expresses a business intent, not generic CRUD.
 */

import { Injectable } from '@nestjs/common';
import {
  FirestoreRepository,
  FirestoreProvider,
  Page,
} from '../infrastructure';

@Injectable()
export class AudioUploadRepository extends FirestoreRepository<AudioUpload> {
  constructor(firestore: FirestoreProvider) {
    super(firestore, 'audio_uploads', new AudioUploadMapper());
  }

  /**
   * Domain-specific query: Find all uploads for a user, paginated
   *
   * @param userId - User ID
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @returns Paginated uploads
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<Page<AudioUpload>> {
    try {
      // Get total count
      const countSnapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .count()
        .get();
      const total = countSnapshot.data().count;

      // Get paginated results
      const offset = (page - 1) * limit;
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(limit + 1)
        .get();

      const items = snapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() };
        return this.mapper.toDomain(data as any);
      });

      const hasNextPage = items.length > limit;
      if (hasNextPage) {
        items.pop(); // Remove the extra fetched item
      }

      return {
        items,
        total,
        page,
        limit,
        hasNextPage,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      this.logger.error(
        `Error finding uploads for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Domain-specific query: Find all pending uploads (for processing queue)
   *
   * @param limit - Maximum results
   * @returns Pending uploads
   */
  async findPending(limit: number = 50): Promise<AudioUpload[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() };
        return this.mapper.toDomain(data as any);
      });
    } catch (error) {
      this.logger.error('Error finding pending uploads', error);
      throw error;
    }
  }

  /**
   * Domain-specific mutation: Mark upload as processing
   *
   * @param uploadId - Upload ID
   * @returns Updated upload
   */
  async markAsProcessing(uploadId: string): Promise<AudioUpload> {
    const upload = await this.findById(uploadId);
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    upload.status = 'processing';
    upload.updatedAt = new Date();

    return this.save(upload);
  }

  /**
   * Domain-specific mutation: Mark upload as completed
   *
   * @param uploadId - Upload ID
   * @param gcsPath - Path to processed file in Google Cloud Storage
   * @returns Updated upload
   */
  async markAsCompleted(uploadId: string, gcsPath: string): Promise<AudioUpload> {
    const upload = await this.findById(uploadId);
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    upload.status = 'completed';
    upload.gcsPath = gcsPath;
    upload.errorMessage = undefined;
    upload.updatedAt = new Date();

    return this.save(upload);
  }

  /**
   * Domain-specific mutation: Mark upload as failed
   *
   * @param uploadId - Upload ID
   * @param errorMessage - Error description
   * @returns Updated upload
   */
  async markAsFailed(
    uploadId: string,
    errorMessage: string,
  ): Promise<AudioUpload> {
    const upload = await this.findById(uploadId);
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    upload.status = 'failed';
    upload.errorMessage = errorMessage;
    upload.updatedAt = new Date();

    return this.save(upload);
  }
}

/**
 * STEP 5: Use Repository in Service Layer
 * =========================================
 *
 * Services orchestrate business logic using repositories.
 * They ensure consistency and handle use-case flows.
 */

@Injectable()
export class AudioUploadService {
  constructor(
    private readonly audioUploadRepository: AudioUploadRepository,
    private readonly unitOfWork: any, // IUnitOfWork
  ) {}

  /**
   * Use case: Create a new audio upload record
   *
   * @param dto - Upload creation data
   * @returns Created upload
   */
  async createUpload(
    userId: string,
    filename: string,
    originalName: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<AudioUpload> {
    // Validate input
    if (!userId || !filename) {
      throw new Error('userId and filename are required');
    }

    if (sizeBytes <= 0) {
      throw new Error('sizeBytes must be greater than 0');
    }

    // Create upload entity
    const upload: AudioUpload = {
      id: '', // Will be generated by repository
      userId,
      filename,
      originalName,
      mimeType,
      sizeBytes,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.audioUploadRepository.save(upload);
  }

  /**
   * Use case: Get uploads for a user
   *
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated uploads
   */
  async getUserUploads(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<Page<AudioUpload>> {
    return this.audioUploadRepository.findByUserId(userId, page, limit);
  }

  /**
   * Use case: Get a specific upload by ID
   *
   * @param uploadId - Upload ID
   * @returns Upload
   */
  async getUploadById(uploadId: string): Promise<AudioUpload> {
    const upload = await this.audioUploadRepository.findById(uploadId);

    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    return upload;
  }

  /**
   * Use case: Start processing an upload
   *
   * @param uploadId - Upload ID
   * @returns Updated upload
   */
  async startProcessing(uploadId: string): Promise<AudioUpload> {
    const upload = await this.getUploadById(uploadId);

    if (upload.status !== 'pending') {
      throw new Error(
        `Only pending uploads can be processed, current status: ${upload.status}`,
      );
    }

    return this.audioUploadRepository.markAsProcessing(uploadId);
  }

  /**
   * Use case: Complete upload processing
   *
   * @param uploadId - Upload ID
   * @param gcsPath - Path to processed file
   * @returns Updated upload
   */
  async completeProcessing(
    uploadId: string,
    gcsPath: string,
  ): Promise<AudioUpload> {
    return this.audioUploadRepository.markAsCompleted(uploadId, gcsPath);
  }

  /**
   * Use case: Get pending uploads for processing queue
   *
   * @param limit - Maximum results
   * @returns Pending uploads
   */
  async getPendingUploads(limit: number = 50): Promise<AudioUpload[]> {
    return this.audioUploadRepository.findPending(limit);
  }
}

/**
 * STEP 6: Use in NestJS Controller
 * =================================
 *
 * Controllers delegate to services, not repositories.
 * This maintains separation of concerns.
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';

@Controller('uploads')
export class AudioUploadController {
  constructor(private readonly audioUploadService: AudioUploadService) {}

  @Post()
  async createUpload(
    @Body()
    dto: {
      userId: string;
      filename: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ): Promise<AudioUpload> {
    return this.audioUploadService.createUpload(
      dto.userId,
      dto.filename,
      dto.originalName,
      dto.mimeType,
      dto.sizeBytes,
    );
  }

  @Get('user/:userId')
  async getUserUploads(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<Page<AudioUpload>> {
    return this.audioUploadService.getUserUploads(userId, page, limit);
  }

  @Get(':id')
  async getUpload(@Param('id') uploadId: string): Promise<AudioUpload> {
    return this.audioUploadService.getUploadById(uploadId);
  }

  @Post(':id/process')
  async startProcessing(@Param('id') uploadId: string): Promise<AudioUpload> {
    return this.audioUploadService.startProcessing(uploadId);
  }

  @Post(':id/complete')
  async completeProcessing(
    @Param('id') uploadId: string,
    @Body() { gcsPath }: { gcsPath: string },
  ): Promise<AudioUpload> {
    return this.audioUploadService.completeProcessing(uploadId, gcsPath);
  }

  @Get('queue/pending')
  async getPendingQueue(
    @Query('limit') limit: number = 50,
  ): Promise<AudioUpload[]> {
    return this.audioUploadService.getPendingUploads(limit);
  }
}

/**
 * STEP 7: Module Registration
 * ============================
 *
 * Register repos and services in NestJS modules.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure';

@Module({
  imports: [DatabaseModule],
  providers: [AudioUploadRepository, AudioUploadService],
  controllers: [AudioUploadController],
  exports: [AudioUploadRepository, AudioUploadService],
})
export class AudioUploadModule {}

/**
 * BEST PRACTICES SUMMARY
 * ======================
 *
 * ✅ DO:
 * - Define domain entities without persistence concerns
 * - Create mappers for explicit persistence/domain conversion
 * - Use domain-specific repository methods (findByUserId, not query())
 * - Inject repositories into services, not controllers
 * - Use Unit of Work for multi-entity operations
 * - Handle errors at appropriate layers
 * - Log operation times for observability
 *
 * ❌ DON'T:
 * - Use generic CRUD repository as business contract
 * - Spread business logic across repositories
 * - Leak Firestore-specific types to domain
 * - Bypass repositories in services
 * - Perform multiple independent transactions when one UoW would work
 * - Ignore N+1 query problems
 *
 * 🔍 TESTING:
 * - Mock repositories for unit tests
 * - Use Firestore Emulator for integration tests
 * - Test mappers separately for correctness
 * - Test service logic without database
 */
