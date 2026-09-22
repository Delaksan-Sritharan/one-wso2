// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Alert, Box, Button, Paper, Skeleton } from "@wso2/oxygen-ui";
import { HttpError } from "@api/http";
import { useRecordingPlayback } from "../api/useRevOpsData";
import { describeError } from "../util/revOpsError";

/**
 * The recording, played in the page.
 *
 * Streamed by drive-service, which holds the Google credential and answers HTTP Range
 * requests 
 */
/** What the page can ask of the player. */
export interface RecordingPlayerHandle {
  /** Jump to a position, in seconds, and start playing. */
  seekTo: (seconds: number) => void;
}

/**
 * Exposes seeking through a ref rather than handing the raw <video> element upwards.
 *
 * The transcript needs exactly one verb — "go to this second" — and giving it the element
 * would let any caller reassign `src` or read internals this component manages. A named
 * handle keeps the player's own concerns (token refresh, error recovery) its own.
 */
const RecordingPlayer = forwardRef<RecordingPlayerHandle, {
  meetingId: number;
  /** Called as playback proceeds, so a transcript can mark the current line. */
  onTimeUpdate?: (seconds: number) => void;
  /**
   * The recording's length, once the browser has read enough to know it.
   *
   * The speaker timeline needs it to place marks: the transcript alone only says when
   * the last person stopped talking, which is not where the recording ends.
   */
  onDurationChange?: (seconds: number) => void;
}>(function RecordingPlayer({ meetingId, onTimeUpdate, onDurationChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = seconds;
      // Playing on seek is the behaviour a reader expects from clicking a line: they asked
      // to hear that part, not to park the playhead on it.
      void video.play();
      // Scroll the player into view — on a narrow screen the transcript may be the only
      // thing visible, and a video that starts playing off-screen reads as nothing happening.
      video.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  }), []);
  const { data, isLoading, error, refetch } = useRecordingPlayback(meetingId);
  // Raised only after a retry has already failed, so a single expiry recovers silently
  // rather than blaming the viewer for a token they never saw.
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const retriedRef = useRef(false);

  /**
   * Recover from a token that expired mid-playback.
   *
   * Playback is not one request but many: the browser buffers ahead and every seek is a
   * fresh range request. So an expired token does not fail cleanly -- what is already
   * buffered keeps playing and the NEXT range request is refused, which reaches the viewer
   * as an unexplained stall. Minting a fresh URL and restoring the position turns that into
   * a blink.
   *
   * Retried once. If a second URL fails too the cause is not expiry, and reloading forever
   * would hammer the backend while showing the viewer nothing.
   */
  const handleError = useCallback(async () => {
    if (retriedRef.current) {
      setPlaybackFailed(true);
      return;
    }
    retriedRef.current = true;

    const resumeAt = videoRef.current?.currentTime ?? 0;
    const refreshed = await refetch();
    const url = refreshed.data?.url;
    if (!url || !videoRef.current) {
      setPlaybackFailed(true);
      return;
    }
    videoRef.current.src = url;
    // Assigning src reloads, discarding position — restore it once there is enough of the
    // new stream to seek into.
    videoRef.current.addEventListener(
      "loadedmetadata",
      () => {
        if (videoRef.current) {
          videoRef.current.currentTime = resumeAt;
          void videoRef.current.play();
        }
      },
      { once: true },
    );
    // Clear the latch only once the replacement is genuinely playing. The rule is
    // "two CONSECUTIVE failures means it is not expiry", but the latch was only ever
    // reset by the Try again button, so it meant "two failures ever" -- a token lasts
    // six hours and a long review session outlives one, and the second expiry would
    // have shown the error banner instead of blinking through it. Waiting for
    // "playing" rather than "loadedmetadata" is what keeps the once-only guarantee:
    // a replacement URL that fails before it plays leaves the latch set.
    videoRef.current.addEventListener(
      "playing",
      () => {
        retriedRef.current = false;
      },
      { once: true },
    );
  }, [refetch]);

  // 404 is not a failure worth an error banner: it means either this deployment has no
  // playback configured, or the recording has not finished processing -- which is the
  // ordinary state of a meeting that just ended. The backend's own message says which.
  const notAvailable = error instanceof HttpError && error.status === 404;

  if (isLoading) {
    return <Skeleton variant="rectangular" sx={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 1 }} />;
  }
  if (notAvailable) {
    return <Alert severity="info">{describeError(error)}</Alert>;
  }
  if (error) {
    return <Alert severity="error">{describeError(error)}</Alert>;
  }
  if (playbackFailed) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            size="small"
            onClick={() => {
              retriedRef.current = false;
              setPlaybackFailed(false);
              void refetch();
            }}
          >
            Try again
          </Button>
        }
      >
        The recording stopped playing. It may have been moved, or your access to it changed.
      </Alert>
    );
  }
  if (!data) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1, overflow: "hidden" }}>
      <Box
        ref={videoRef}
        component="video"
        src={data.url}
        controls
        // Not autoplay: a recording is long and often opened just to see what it is, and a
        // browser would block the sound anyway.
        preload="metadata"
        onError={handleError}
        onTimeUpdate={
          onTimeUpdate
            ? (e) => onTimeUpdate((e.currentTarget as HTMLVideoElement).currentTime)
            : undefined
        }
        onLoadedMetadata={
          onDurationChange
            ? (e) => {
                const d = (e.currentTarget as HTMLVideoElement).duration;
                // Infinity until a streamed file's length is known — reporting that
                // would make every timeline mark divide by it.
                if (Number.isFinite(d)) onDurationChange(d);
              }
            : undefined
        }
        sx={{ width: "100%", display: "block", borderRadius: 0.5, bgcolor: "common.black" }}
      />
    </Paper>
  );
});

export default RecordingPlayer;
