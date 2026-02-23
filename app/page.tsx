import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const session = cookieStore.get('trip_session')
  if (session?.value) {
    redirect('/dashboard')
  } else {
    redirect('/unlock')
  }
}
