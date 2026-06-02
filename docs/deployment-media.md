# Media and deployment notes

DrivePrep uses local media for parsed theory pages, handbook pages, road signs, road markings, and question illustrations.

## Where media lives

- `backend/public/images/theory/` - tracked theory seed images that are safe to keep in Git.
- `backend/uploads/theory/` - generated/imported theory and handbook media.
- `backend/uploads/handbook/` - handbook images, signs, markings, and media maps.
- `backend/uploads/maps/` - small JSON maps used to connect parsed content with local files.

## Why uploads are not fully tracked

The uploaded media set is large. The current local set is about 1 GB, so it should not be committed directly to Git as normal source code.

For local development, the files are read directly from `backend/uploads`. For Docker-based deployments from this machine, `.dockerignore` keeps the required upload media in the Docker build context.

For a clean deployment from GitHub only, choose one of these options:

1. Upload `backend/uploads/theory` and the required handbook media to object storage or CDN, then point the backend/frontend URLs there.
2. Add a deployment restore step that downloads a prepared media archive before starting the app.
3. Run the parser/importer on the server and let it recreate the files, if the host allows enough time and disk space.

## Before deploy

Run:

```bash
npm run backend:audit-media
```

The expected result is:

```text
missing=0
docker_not_covered=0
```

If `missing` is not zero, theory pages or questions may show broken images. If `docker_not_covered` is not zero, a Docker deployment from the local workspace may miss media files.

## Runtime protection

The backend also filters unavailable local media before sending theory content to the frontend. This prevents old database rows from rendering broken local images if the database references files that are no longer present.
