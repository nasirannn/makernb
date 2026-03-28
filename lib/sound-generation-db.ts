import { query } from '@/lib/db-query-builder';
import type {
  SoundGenerationMetadata,
  UpsertSoundGenerationMetadataData,
  UpdateSoundGenerationMetadataData,
} from '@/types/sound-generation';

type QueryExecutor = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;

const mapRow = (row: any): SoundGenerationMetadata => ({
  id: row.id,
  musicId: row.music_id,
  soundLoop: row.sound_loop,
  soundType: row.sound_loop ? 'loop' : 'one-shot',
  soundTempo: row.sound_tempo,
  soundKey: row.sound_key,
  grabLyrics: row.grab_lyrics,
  providerRequestJson: row.provider_request_json,
  providerCreateResponseJson: row.provider_create_response_json,
  providerRecordInfoJson: row.provider_record_info_json,
  resultAudioIdsJson: row.result_audio_ids_json,
  r2AudioUrlsJson: row.r2_audio_urls_json,
  resultTrackCount: row.result_track_count,
  errorCode: row.error_code,
  errorMessage: row.error_message,
  lastSyncedAt: row.last_synced_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function upsertSoundGenerationMetadata(
  data: UpsertSoundGenerationMetadataData,
  executor: QueryExecutor = query,
): Promise<SoundGenerationMetadata> {
  const result = await executor(
    `INSERT INTO sound_generation_metadata (
      music_id, sound_loop, sound_tempo, sound_key, grab_lyrics,
      provider_request_json, provider_create_response_json, provider_record_info_json,
      result_audio_ids_json, r2_audio_urls_json, result_track_count, error_code, error_message, last_synced_at
    ) VALUES (
      $1::uuid, $2, $3, $4, $5,
      $6::jsonb, $7::jsonb, $8::jsonb,
      $9::jsonb, $10::jsonb, $11, $12, $13, $14::timestamptz
    )
    ON CONFLICT (music_id)
    DO UPDATE SET
      sound_loop = EXCLUDED.sound_loop,
      sound_tempo = EXCLUDED.sound_tempo,
      sound_key = EXCLUDED.sound_key,
      grab_lyrics = EXCLUDED.grab_lyrics,
      provider_request_json = COALESCE(EXCLUDED.provider_request_json, sound_generation_metadata.provider_request_json),
      provider_create_response_json = COALESCE(EXCLUDED.provider_create_response_json, sound_generation_metadata.provider_create_response_json),
      provider_record_info_json = COALESCE(EXCLUDED.provider_record_info_json, sound_generation_metadata.provider_record_info_json),
      result_audio_ids_json = COALESCE(EXCLUDED.result_audio_ids_json, sound_generation_metadata.result_audio_ids_json),
      r2_audio_urls_json = COALESCE(EXCLUDED.r2_audio_urls_json, sound_generation_metadata.r2_audio_urls_json),
      result_track_count = COALESCE(EXCLUDED.result_track_count, sound_generation_metadata.result_track_count),
      error_code = COALESCE(EXCLUDED.error_code, sound_generation_metadata.error_code),
      error_message = COALESCE(EXCLUDED.error_message, sound_generation_metadata.error_message),
      last_synced_at = COALESCE(EXCLUDED.last_synced_at, sound_generation_metadata.last_synced_at),
      updated_at = NOW()
    RETURNING *`,
    [
      data.musicId,
      data.soundLoop ?? false,
      data.soundTempo ?? null,
      data.soundKey ?? null,
      data.grabLyrics ?? false,
      data.providerRequestJson === undefined ? null : JSON.stringify(data.providerRequestJson),
      data.providerCreateResponseJson === undefined ? null : JSON.stringify(data.providerCreateResponseJson),
      data.providerRecordInfoJson === undefined ? null : JSON.stringify(data.providerRecordInfoJson),
      data.resultAudioIdsJson === undefined ? null : JSON.stringify(data.resultAudioIdsJson),
      data.r2AudioUrlsJson === undefined ? null : JSON.stringify(data.r2AudioUrlsJson),
      data.resultTrackCount ?? 0,
      data.errorCode ?? null,
      data.errorMessage ?? null,
      data.lastSyncedAt ?? null,
    ]
  );

  return mapRow(result.rows[0]);
}

export async function updateSoundGenerationMetadataByTaskId(
  taskId: string,
  data: UpdateSoundGenerationMetadataData,
  executor: QueryExecutor = query,
): Promise<SoundGenerationMetadata | null> {
  const result = await executor(
    `UPDATE sound_generation_metadata sgm
     SET provider_create_response_json = COALESCE($2::jsonb, sgm.provider_create_response_json),
         provider_record_info_json = COALESCE($3::jsonb, sgm.provider_record_info_json),
         result_audio_ids_json = COALESCE($4::jsonb, sgm.result_audio_ids_json),
         r2_audio_urls_json = COALESCE($5::jsonb, sgm.r2_audio_urls_json),
         result_track_count = COALESCE($6, sgm.result_track_count),
         error_code = $7,
         error_message = $8,
         last_synced_at = COALESCE($9::timestamptz, sgm.last_synced_at),
         updated_at = NOW()
     FROM music mg
     WHERE mg.task_id = $1
       AND sgm.music_id = mg.id
     RETURNING sgm.*`,
    [
      taskId,
      data.providerCreateResponseJson === undefined ? null : JSON.stringify(data.providerCreateResponseJson),
      data.providerRecordInfoJson === undefined ? null : JSON.stringify(data.providerRecordInfoJson),
      data.resultAudioIdsJson === undefined ? null : JSON.stringify(data.resultAudioIdsJson),
      data.r2AudioUrlsJson === undefined ? null : JSON.stringify(data.r2AudioUrlsJson),
      data.resultTrackCount ?? null,
      data.errorCode ?? null,
      data.errorMessage ?? null,
      data.lastSyncedAt ?? null,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}
