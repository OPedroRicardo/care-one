import { createApp } from '@api-service/app.ts'

const app = await createApp()

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`OK! Process running on port ${process.env.PORT ?? 3000}`)
})

export default app
