import { startTransition, useEffect, useRef, useState } from 'react'
import './App.css'
import { leadershipQuestions } from './data/questions'
import { transcribeAudio } from './lib/asr'
import {
  analyzeLeadershipResponse,
  type CoachingFeedback,
} from './lib/coaching'

type SessionState = 'idle' | 'recording' | 'transcribing' | 'complete' | 'error'
type AppPage = 'practice' | 'analysis'

const MAX_RECORDING_SECONDS = 90

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function getPreferredMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return ''
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('practice')
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [statusMessage, setStatusMessage] = useState(
    'Choose a prompt, record your answer, then analyze it on the next screen.',
  )
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [rawTranscript, setRawTranscript] = useState('')
  const [editableTranscript, setEditableTranscript] = useState('')
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const activeQuestion = leadershipQuestions[activeQuestionIndex]
  const isBusy =
    sessionState === 'recording' || sessionState === 'transcribing'
  const canAnalyze =
    sessionState === 'complete' && editableTranscript.trim().length > 0

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function revokeAudioUrl() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
  }

  function clearSession(nextStatusMessage?: string) {
    stopTimer()
    chunksRef.current = []
    setRecordingSeconds(0)
    setRawTranscript('')
    setEditableTranscript('')
    setFeedback(null)
    setErrorMessage('')
    setSessionState('idle')
    if (nextStatusMessage) {
      setStatusMessage(nextStatusMessage)
    }
    revokeAudioUrl()
  }

  function restartPractice() {
    setCurrentPage('practice')
    clearSession('Record a fresh answer for this scenario.')
  }

  function finishRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') {
      return
    }

    stopTimer()
    setSessionState('transcribing')
    setStatusMessage('Preparing your audio for transcription.')
    recorder.stop()
  }

  function analyzeAnswer() {
    if (!canAnalyze) {
      return
    }

    setFeedback(
      analyzeLeadershipResponse(editableTranscript.trim(), activeQuestion),
    )
    setCurrentPage('analysis')
    setStatusMessage('Feedback ready. Practice the rewrite, then try again.')
  }

  useEffect(() => {
    return () => {
      stopTimer()
      stopStream()
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  useEffect(() => {
    if (sessionState !== 'recording') {
      return undefined
    }

    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((currentSeconds) => currentSeconds + 1)
    }, 1000)

    return () => {
      stopTimer()
    }
  }, [sessionState])

  useEffect(() => {
    if (sessionState !== 'recording' || recordingSeconds < MAX_RECORDING_SECONDS) {
      return
    }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') {
      return
    }

    stopTimer()
    setSessionState('transcribing')
    setStatusMessage('Preparing your audio for transcription.')
    recorder.stop()
  }, [recordingSeconds, sessionState])

  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setSessionState('error')
      setErrorMessage('This browser does not support microphone recording.')
      return
    }

    clearSession('Requesting microphone access.')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      })

      streamRef.current = stream
      const mimeType = getPreferredMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        stopStream()
        setSessionState('error')
        setErrorMessage('Recording failed. Please retry.')
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        chunksRef.current = []
        stopStream()

        revokeAudioUrl()
        setAudioUrl(URL.createObjectURL(blob))

        try {
          const nextTranscript = await transcribeAudio(blob, setStatusMessage)
          if (!nextTranscript) {
            throw new Error(
              'No clear speech was detected. Try speaking closer to the microphone.',
            )
          }

          startTransition(() => {
            setRawTranscript(nextTranscript)
            setEditableTranscript(nextTranscript)
            setSessionState('complete')
            setStatusMessage(
              'Transcript ready. Edit it if needed, then click Analyze.',
            )
          })
        } catch (error) {
          setSessionState('error')
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Transcription failed. Please retry.',
          )
        } finally {
          mediaRecorderRef.current = null
        }
      }

      recorder.start(250)
      setSessionState('recording')
      setStatusMessage(
        'Recording. Answer as if you are already in the leadership conversation.',
      )
    } catch (error) {
      stopStream()
      setSessionState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Microphone access was not granted.',
      )
    }
  }

  function selectQuestion(index: number) {
    if (isBusy) {
      return
    }

    setCurrentPage('practice')
    setActiveQuestionIndex(index)
    clearSession('Prompt switched. Record a fresh answer when ready.')
  }

  function loadNextQuestion() {
    if (isBusy) {
      return
    }

    const nextIndex = (activeQuestionIndex + 1) % leadershipQuestions.length
    setCurrentPage('practice')
    setActiveQuestionIndex(nextIndex)
    clearSession('Next scenario loaded. Record when ready.')
  }

  return (
    <div className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Leadership communication trainer</p>
          <h1>Practice, then analyze how a leader would say it.</h1>
          <p className="hero-text">
            This flow is split into two pages: first choose a scenario and speak,
            then move into a dedicated analysis screen with feedback and a retry path.
          </p>
          <div className="flow-steps">
            <div className={`flow-step ${currentPage === 'practice' ? 'active' : 'done'}`}>
              <span>1</span>
              <strong>Select + record</strong>
            </div>
            <div className={`flow-step ${currentPage === 'analysis' ? 'active' : ''}`}>
              <span>2</span>
              <strong>Analyze feedback</strong>
            </div>
          </div>
        </div>

        <div className="hero-stat">
          {currentPage === 'practice' ? (
            <>
              <div className="score-ring step-ring">
                <strong>01</strong>
                <span>record first</span>
              </div>
              <p>
                Select the scenario, answer out loud, and only then move forward
                to the analysis page.
              </p>
            </>
          ) : (
            <>
              <div className="score-ring">
                <strong>{feedback?.overallScore ?? '--'}</strong>
                <span>leadership score</span>
              </div>
              <p>
                Strong leadership communication is usually direct, empathetic, and
                explicit about the next move.
              </p>
            </>
          )}
        </div>
      </section>

      {currentPage === 'practice' ? (
        <main className="workspace">
          <aside className="question-rail">
            <div className="section-heading">
              <p className="section-label">Scenario set</p>
              <h2>Choose a leadership moment</h2>
            </div>

            <div className="question-list">
              {leadershipQuestions.map((question, index) => {
                const isActive = index === activeQuestionIndex
                return (
                  <button
                    key={question.id}
                    className={`question-card ${isActive ? 'active' : ''}`}
                    onClick={() => selectQuestion(index)}
                    disabled={isBusy}
                    aria-pressed={isActive}
                    type="button"
                  >
                    <div className="question-card-top">
                      <div className="question-card-heading">
                        <span className="question-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="question-title">{question.title}</span>
                      </div>
                      {isActive ? (
                        <span className="selected-pill" aria-label="Selected scenario">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p>{question.situation}</p>
                    <div className="tag-row">
                      {question.focus.map((focus) => (
                        <span key={focus}>{focus}</span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="studio">
            <div className="prompt-card panel">
              <div className="section-heading">
                <p className="section-label">Active prompt</p>
                <h2>{activeQuestion.title}</h2>
              </div>
              <p className="prompt-situation">{activeQuestion.situation}</p>
              <blockquote>{activeQuestion.prompt}</blockquote>
              <p className="goal-line">
                Coaching target: <strong>{activeQuestion.goal}</strong>
              </p>
            </div>

            <div className="recorder-grid">
              <div className="panel recorder-panel">
                <div className="section-heading">
                  <p className="section-label">Step 1</p>
                  <h2>Record your response</h2>
                </div>

                <div className={`mic-stage ${sessionState}`}>
                  <button
                    className={`record-button ${sessionState === 'recording' ? 'live' : ''}`}
                    onClick={
                      sessionState === 'recording' ? finishRecording : startRecording
                    }
                    type="button"
                    disabled={sessionState === 'transcribing'}
                  >
                    {sessionState === 'recording' ? 'Stop' : 'Record'}
                  </button>

                  <div className="mic-readout">
                    <strong>{formatSeconds(recordingSeconds)}</strong>
                    <span>{statusMessage}</span>
                  </div>
                </div>

                <div className="supporting-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      clearSession(
                        'Session cleared. Record again when you are ready.',
                      )
                    }
                    type="button"
                    disabled={isBusy}
                  >
                    Clear
                  </button>
                  <button
                    className="secondary-button"
                    onClick={loadNextQuestion}
                    type="button"
                    disabled={isBusy}
                  >
                    Next prompt
                  </button>
                </div>

                <div className="status-stack">
                  <div className="status-card">
                    <span>Mode</span>
                    <strong>Voice coaching</strong>
                  </div>
                  <div className="status-card">
                    <span>Max answer</span>
                    <strong>{MAX_RECORDING_SECONDS}s</strong>
                  </div>
                  <div className="status-card">
                    <span>Coach focus</span>
                    <strong>{activeQuestion.focus[0]}</strong>
                  </div>
                </div>

                {audioUrl ? (
                  <audio className="audio-preview" controls src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                ) : null}

                {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
              </div>

              <div className="panel transcript-panel">
                <div className="section-heading">
                  <p className="section-label">Step 2</p>
                  <h2>Review, then analyze</h2>
                </div>

                <div className={`transcript-box ${editableTranscript ? 'ready' : ''}`}>
                  <div className="transcript-box-head">
                    <span>Transcript</span>
                    {editableTranscript ? <strong>Editable</strong> : null}
                  </div>

                  {editableTranscript ? (
                    <div className="transcript-editor-wrap">
                      <textarea
                        className="transcript-editor"
                        value={editableTranscript}
                        onChange={(event) =>
                          setEditableTranscript(event.target.value)
                        }
                        placeholder="Your transcript will appear here."
                      />
                      <p className="transcript-helper">
                        Edit the transcript before analysis if Whisper missed any
                        words.
                      </p>
                      {rawTranscript !== editableTranscript ? (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setEditableTranscript(rawTranscript)}
                        >
                          Revert to original transcript
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="placeholder-text">
                      {sessionState === 'transcribing'
                        ? 'Transcribing your answer now. The transcript will appear here as soon as Whisper finishes.'
                        : 'After the recording is transcribed, your answer appears here. Then you move to the next page with the Analyze button.'}
                    </p>
                  )}
                </div>

                <div className="page-actions">
                  <button
                    className="primary-button"
                    onClick={analyzeAnswer}
                    type="button"
                    disabled={!canAnalyze}
                  >
                    Analyze
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="analysis-page">
          <section className="panel analysis-overview">
            <div className="analysis-header">
              <div>
                <p className="section-label">Analysis</p>
                <h2>{activeQuestion.title}</h2>
              </div>
              <button
                className="primary-button"
                onClick={restartPractice}
                type="button"
              >
                Try again
              </button>
            </div>

            <div className="analysis-summary-grid">
              <article className="summary-card">
                <span>Scenario</span>
                <strong>{activeQuestion.situation}</strong>
              </article>
              <article className="summary-card">
                <span>Your transcript</span>
                <strong>{editableTranscript}</strong>
              </article>
            </div>
          </section>

          <div className="coaching-grid">
            <section className="panel">
              <div className="section-heading">
                <p className="section-label">Coach view</p>
                <h2>How the message lands</h2>
              </div>

              {feedback ? (
                <>
                  <p className="feedback-summary">{feedback.summary}</p>
                  <div className="metric-list">
                    {feedback.metrics.map((metric) => (
                      <article key={metric.label} className="metric-card">
                        <div className="metric-head">
                          <span>{metric.label}</span>
                          <strong>{metric.score}</strong>
                        </div>
                        <div className="meter-track">
                          <div
                            className="meter-fill"
                            style={{ width: `${metric.score}%` }}
                          />
                        </div>
                        <p>{metric.detail}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-label">Word choice</p>
                <h2>Phrase upgrades</h2>
              </div>

              {feedback?.phraseUpgrades.length ? (
                <div className="upgrade-list">
                  {feedback.phraseUpgrades.map((upgrade) => (
                    <article
                      key={`${upgrade.weak}-${upgrade.better}`}
                      className="upgrade-card"
                    >
                      <div className="upgrade-pair">
                        <span className="weak-phrase">{upgrade.weak}</span>
                        <span className="arrow">-&gt;</span>
                        <span className="strong-phrase">{upgrade.better}</span>
                      </div>
                      <p>{upgrade.why}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-label">Keep doing</p>
                <h2>Strengths</h2>
              </div>

              {feedback ? (
                <ul className="insight-list">
                  {feedback.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-label">Tighten next</p>
                <h2>Improvement targets</h2>
              </div>

              {feedback ? (
                <ul className="insight-list">
                  {feedback.improvements.map((improvement) => (
                    <li key={improvement}>{improvement}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          <section className="panel rewrite-panel">
            <div className="section-heading">
              <p className="section-label">Leader version</p>
              <h2>Stronger wording to practice next</h2>
            </div>

            {feedback ? <p className="rewrite-text">{feedback.rewrite}</p> : null}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
