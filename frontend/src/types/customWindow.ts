export interface CustomWindow extends Window {
  localStream: MediaStream | null;
  localAudioStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  localScreenAudioStream: MediaStream | null;
}
