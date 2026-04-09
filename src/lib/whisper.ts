import OpenAI from 'openai';
import FormData from 'form-data';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const allowedMimeTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('Invalid audio MIME type');
  }

  if (audioBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Audio file too large (max 10MB)');
  }

  const extension = mimeType === 'audio/ogg' ? 'ogg' :
                    mimeType === 'audio/mpeg' ? 'mp3' :
                    mimeType === 'audio/mp4' ? 'mp4' :
                    mimeType === 'audio/wav' ? 'wav' : 'webm';

  const file = new File([new Uint8Array(audioBuffer)], `audio.${extension}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
  });

  return transcription.text;
}
