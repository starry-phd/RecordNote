/** RecordNote new-recording-only D1 persistence helper.
 * For integration after deployed Worker source is mirrored to GitHub.
 * Does not update old recordings, media rows, or R2.
 * Call only after rnOriginPayload and media ownership/cutover checks.
 */
const SELECT_ORIGIN = `SELECT media_id, owner_id, client_recording_id, recorded_at_ms,
 recorded_timezone, gps_lat, gps_lon, gps_accuracy_m, location_name,
 location_source, policy_revision, metadata_write_status
 FROM rn_recording_origin_v1 WHERE media_id=?`;

const INSERT_ORIGIN = `INSERT INTO rn_recording_origin_v1
 (media_id,owner_id,client_recording_id,recorded_at_ms,recorded_timezone,
 gps_lat,gps_lon,gps_accuracy_m,location_name,location_source,
 policy_revision,metadata_write_status,created_at_ms)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(media_id) DO NOTHING`;

function error(code){const e=new Error(code);e.code=code;return e;}

function expectedRow(mediaId,ownerId,origin){
  if(typeof mediaId!=='string'||!mediaId||typeof ownerId!=='string'||!ownerId ||
     !origin||typeof origin.id!=='string'||!Number.isSafeInteger(origin.time)||
     typeof origin.zone!=='string'||!origin.zone||typeof origin.writer!=='string'){
    throw error('ORIGIN_INVALID_INTERNAL_INPUT');
  }
  return {
    media_id:mediaId,owner_id:ownerId,client_recording_id:origin.id,
    recorded_at_ms:origin.time,recorded_timezone:origin.zone,
    gps_lat:origin.lat??null,gps_lon:origin.lon??null,
    gps_accuracy_m:origin.accuracy??null,
    location_name:origin.place||null,
    location_source:origin.source||null,
    policy_revision:origin.revision??null,
    metadata_write_status:origin.writer,
  };
}
function assertSame(row,expected){
  if(!row)throw error('ORIGIN_NOT_PERSISTED');
  for(const [key,value] of Object.entries(expected)){
    if((row[key]??null)!==value)throw error('ORIGIN_IMMUTABLE');
  }
}

/** Success requires an exact D1 readback. Never silently ignore constraints.
 * Map ORIGIN_IMMUTABLE to HTTP 409; persistence failures to a non-2xx response.
 */
export async function storeOriginVerified(db,{mediaId,ownerId,origin,nowMs}){
  if(!db||typeof db.prepare!=='function'||!Number.isSafeInteger(nowMs)||nowMs<0){
    throw error('ORIGIN_INVALID_INTERNAL_INPUT');
  }
  const wanted=expectedRow(mediaId,ownerId,origin);
  const first=await db.prepare(SELECT_ORIGIN).bind(mediaId).first();
  if(first){assertSame(first,wanted);return {mediaId,replayed:true,verified:true};}
  const result=await db.prepare(INSERT_ORIGIN).bind(
    wanted.media_id,wanted.owner_id,wanted.client_recording_id,wanted.recorded_at_ms,
    wanted.recorded_timezone,wanted.gps_lat,wanted.gps_lon,wanted.gps_accuracy_m,
    wanted.location_name,wanted.location_source,wanted.policy_revision,
    wanted.metadata_write_status,nowMs,
  ).run();
  const actual=await db.prepare(SELECT_ORIGIN).bind(mediaId).first();
  assertSame(actual,wanted);
  return {mediaId,replayed:(result?.meta?.changes===0),verified:true};
}
