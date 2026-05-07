import { headers } from 'next/headers'
import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'

import { auth } from '@/lib/auth'

const f = createUploadthing()

export const ourFileRouter = {
  invoicePdfUploader: f({
    pdf: {
      maxFileSize: '8MB',
      maxFileCount: 1
    }
  })
    .middleware(async () => {
      const session = await auth.api.getSession({
        headers: await headers()
      })

      if (!session?.user?.id || !session.user.parishCouncilId) {
        throw new UploadThingError('Unauthorised')
      }

      return {
        userId: session.user.id,
        parishCouncilId: session.user.parishCouncilId
      }
    })
    .onUploadComplete(async ({ file, metadata }) => {
      return {
        uploadedBy: metadata.userId,
        parishCouncilId: metadata.parishCouncilId,
        url: file.ufsUrl,
        name: file.name,
        key: file.key
      }
    })
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
