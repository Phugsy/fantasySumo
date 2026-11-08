import { useState } from "react";
import { useDisplayPreferences } from "../DisplayPreferences";
import type { RikishiPhoto as Photo } from "../types";
import * as styles from "./RikishiPhoto.css";

export function RikishiPhoto({
  photo,
  illustration,
}: {
  photo?: Photo;
  illustration?: { url: string };
}) {
  const { preferences } = useDisplayPreferences();
  const illustrated = preferences.portraitStyle === "illustrations";
  const portrait = illustrated ? illustration : photo;
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <span className={styles.frame} aria-hidden="true">
      {portrait !== undefined && failedUrl !== portrait.url ? (
        <img
          className={illustrated ? styles.illustrationImage : styles.image}
          src={portrait.url}
          alt=""
          width={48}
          height={56}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(portrait.url)}
        />
      ) : (
        <span>{illustrated ? "No illustration" : "No photo"}</span>
      )}
    </span>
  );
}

export function PhotoCredits({ photos }: { photos: Array<Photo | undefined> }) {
  const { preferences } = useDisplayPreferences();
  if (preferences.portraitStyle === "illustrations") {
    return <p className={styles.credits}>AI-generated ink illustrations</p>;
  }
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
