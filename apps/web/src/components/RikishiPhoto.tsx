import { useState } from "react";
import type { RikishiPhoto as Photo } from "../types";
import * as styles from "./RikishiPhoto.css";

export function RikishiPhoto({ photo }: { photo?: Photo }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <span className={styles.frame} aria-hidden="true">
      {photo !== undefined && failedUrl !== photo.url ? (
        <img
          className={styles.image}
          src={photo.url}
          alt=""
          width={48}
          height={56}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photo.url)}
        />
      ) : (
        <span>No photo</span>
      )}
    </span>
  );
}

export function PhotoCredits({ photos }: { photos: Array<Photo | undefined> }) {
  const unique = [
    ...new Map(
      photos
        .filter((photo): photo is Photo => photo !== undefined)
        .map((photo) => [photo.sourceUrl, photo]),
    ).values(),
  ];
  if (unique.length === 0) return null;
  return (
    <details className={styles.credits}>
      <summary>Photo credits</summary>
      <ul>
        {unique.map((photo) => (
          <li key={photo.sourceUrl}>
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
              {photo.author}
            </a>
            {" · "}
            {photo.licenseUrl ? (
              <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                {photo.license}
              </a>
            ) : (
              photo.license
            )}
            {" · displayed at thumbnail size, uncropped"}
          </li>
        ))}
      </ul>
    </details>
  );
}
