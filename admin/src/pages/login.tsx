import { FieldValues, useForm } from 'react-hook-form'
import AVATAR_COLORS from '../lib/avatar-colors'
import Avatar from 'boring-avatars'
import React from 'preact/compat'
import RequestStatus from '../lib/request-status'
import app from '../mangobase-app'
import styles from './login.module.css'
import { useNavigate } from 'react-router-dom'

function Login() {
  const { handleSubmit, register, watch } = useForm()
  const [username, setUsername] = React.useState('')
  const [isNew, setNew] = React.useState(false)
  const [status, setStatus] = React.useState<RequestStatus>('idle')

  const navigate = useNavigate()

  const nameChangeTime = React.useRef<ReturnType<typeof setTimeout>>()

  async function login(form: FieldValues) {
    setStatus('in-progress')
    try {
      if (isNew) {
        await app.req.post('users', {
          ...form,
          fullname: form.username,
          role: 'dev',
        })
      }

      const { data } = await app.req.post('login', { ...form })
      app.set('auth', data)

      navigate('/collections', { replace: true })
    } catch (err) {
      setStatus('failed')
    }
  }

  const $username = watch('username')
  React.useEffect(() => {
    clearTimeout(nameChangeTime.current)
    nameChangeTime.current = setTimeout(() => {
      setUsername($username)
    }, 1000)
  }, [$username])

  React.useEffect(() => {
    app.req.get('_dev/dev-setup').then((res) => setNew(!res.data))
  }, [])

  return (
    <div className="container py-5">
      <div className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit(login)}>
          <div className="d-flex flex-column align-items-center">
            <Avatar
              variant="beam"
              colors={AVATAR_COLORS}
              name={username || ''}
            />
            <fieldset className="mt-3 w-100 d-flex flex-column align-items-center">
              {isNew && (
                <>
                  <p className=" text-center text-secondary">
                    New environment. Be the first dev.
                  </p>
                  <input
                    type="email"
                    placeholder="email"
                    className="d-block w-100 mb-2"
                    {...register('email', { required: true })}
                  />
                </>
              )}

              <input
                type="text"
                placeholder="username"
                className="d-block w-100 mb-2"
                {...register('username', { required: true })}
              />

              <input
                type="password"
                placeholder="password"
                className="d-block w-100 mb-2"
                {...register('password', { required: true })}
              />

              <button className="primary" disabled={status === 'in-progress'}>
                {status === 'in-progress' ? 'Please wait…' : 'Continue'}
              </button>
            </fieldset>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login