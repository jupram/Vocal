import type {
  AutomaticSpeechRecognitionPipeline,
  DataType,
  PretrainedModelOptions,
} from '@huggingface/transformers'

type StatusReporter = (message: string) => void

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

const MODEL_ID = 'Xenova/whisper-tiny.en'
const SAFE_MIXED_PRECISION_DTYPE: Record<string, DataType> = {
  embed_tokens: 'fp32',
  encoder_model: 'fp32',
  decoder_model_merged: 'q4',
}

const TRANSCRIBER_CONFIGS: Array<{
  label: string
  options: PretrainedModelOptions
}> = [
  {
    label: 'safe mixed precision',
    options: {
      device: 'wasm',
      dtype: SAFE_MIXED_PRECISION_DTYPE,
    },
  },
  {
    label: 'full precision fallback',
    options: {
      device: 'wasm',
      dtype: 'fp32',
    },
  },
]

function mixToMono(audioBuffer: AudioBuffer) {
  const { numberOfChannels, length } = audioBuffer
  if (numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }

  const mono = new Float32Array(length)
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      mono[index] += channelData[index] / numberOfChannels
    }
  }
  return mono
}

async function blobToMonoAudio(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: 16_000 })

  try {
    const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    return mixToMono(decodedAudio)
  } finally {
    await audioContext.close()
  }
}

async function getTranscriber(reportStatus: StatusReporter) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers')

      let lastError: unknown = null

      for (const config of TRANSCRIBER_CONFIGS) {
        try {
          reportStatus(
            `Loading Whisper Tiny in your browser using ${config.label}. The first run can take 20-60 seconds.`,
          )
          return await pipeline(
            'automatic-speech-recognition',
            MODEL_ID,
            config.options,
          )
        } catch (error) {
          lastError = error
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error('Failed to initialize Whisper Tiny.')
    })()

    transcriberPromise = transcriberPromise.catch((error) => {
      transcriberPromise = null
      throw error
    })
  }

  return transcriberPromise
}

export async function transcribeAudio(blob: Blob, reportStatus: StatusReporter) {
  const audio = await blobToMonoAudio(blob)
  const transcriber = await getTranscriber(reportStatus)

  reportStatus('Transcribing your answer with Whisper Tiny.')
  const result = await transcriber(audio, { chunk_length_s: 20, stride_length_s: 5 })
  return typeof result?.text === 'string' ? result.text.trim() : ''
}
