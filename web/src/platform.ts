/** Shared interface; native microphone recording must use verified Android/iOS implementations. */
export type RecorderCaps={backgroundRecording:boolean;nativeFileRecovery:boolean;exportM4A16k64kbps:boolean};
export interface RecorderPlatform{
  readonly capabilities:RecorderCaps;
  startSession(courseId:string):Promise<{sessionId:string}>;
  pauseSession(sessionId:string):Promise<void>;
  resumeSession(sessionId:string):Promise<void>;
  stopSession(sessionId:string):Promise<{localFileUri:string;durationSeconds:number}>;
  recoverInterruptedSessions():Promise<Array<{sessionId:string;localFileUri:string}>>;
}
export const webPlatform:RecorderPlatform={
  capabilities:{backgroundRecording:false,nativeFileRecovery:false,exportM4A16k64kbps:false},
  async startSession(){throw new Error('Native recorder or verified web encoder required');},
  async pauseSession(){throw new Error('Recorder unavailable');},
  async resumeSession(){throw new Error('Recorder unavailable');},
  async stopSession(){throw new Error('Recorder unavailable');},
  async recoverInterruptedSessions(){return [];},
};
