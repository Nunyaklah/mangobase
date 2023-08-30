import {
  FieldValues,
  RegisterOptions,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import Button from './button'
import Chip from './chip'
import Collection from '../client/collection'
import Field from './field'
import { FieldType } from '../lib/field-types'
import Input from './input'
import { Link } from 'react-router-dom'
import React from 'preact/compat'
import app from '../mangobase-app'
import indexed from '../lib/indexed'
import { loadCollections } from '../data/collections'

interface Props {
  onHide?: (collection?: Collection) => void
  collection?: Collection
}

interface FieldProps {
  existing?: boolean
  name: string
  required: boolean
  removed?: boolean
  type: FieldType
  unique?: boolean
}

function CollectionForm({ collection, onHide }: Props) {
  const { control, handleSubmit, register, reset, setValue, watch } = useForm()
  const { fields, append, remove } = useFieldArray({ control, name: 'fields' })

  function handleRemove(index: number) {
    const field = fields[index] as unknown as FieldProps
    if (field.existing) {
      setValue(`fields.${index}.removed`, true)
      return
    }

    remove(index)
  }

  function handleRestore(index: number) {
    setValue(`fields.${index}.removed`, false)
  }

  async function save(form: FieldValues) {
    const { name, options, fields } = form

    const migrationSteps = []

    if (collection) {
      if (name !== collection.name) {
        migrationSteps.push({
          collection: collection.name,
          to: name,
          type: 'rename-collection',
        })
      }

      const oldFields = Object.entries(collection.schema)
      for (const [field, i] of indexed(fields as FieldProps[])) {
        if (i >= oldFields.length) {
          break
        }

        const [oldName] = oldFields[i]
        if (field.removed) {
          migrationSteps.push({
            collection: collection.name,
            name: oldName,
            type: 'remove-field',
          })
          continue
        }

        if (oldName !== field.name) {
          migrationSteps.push({
            collection: collection.name,
            from: oldName,
            to: field.name,
            type: 'rename-field',
          })
        }
      }
    }

    const data = {
      exposed: options.includes('expose'),
      indexes: indexesFromForm(fields),
      migrationSteps,
      name,
      schema: schemaFromForm(fields),
      template: options.includes('is-template'),
    }

    const newCollection = collection
      ? await app.editCollection(collection.name, data)
      : await app.addCollection(data)

    await loadCollections()

    handleOnHide(newCollection)
  }

  const getFieldName = React.useCallback(() => {
    const unnamedFields = (fields as unknown as { name: string }[])
      .filter((field) => /^field\d*$/.test(field.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    let fieldName = 'field1'
    let i = 0
    while (unnamedFields[i]?.name === fieldName) {
      i += 1
      fieldName = `field${i + 1}`
    }

    return fieldName
  }, [fields])

  const addNewField = React.useCallback(() => {
    append({ name: getFieldName(), type: 'string' })
  }, [append, getFieldName])

  function handleOnHide(collection?: Collection) {
    reset()
    remove()
    onHide?.(collection)
  }

  React.useEffect(() => {
    if (!collection) return

    setValue('name', collection.name)
    setValue('exposed', collection.exposed)

    for (const [field, options] of Object.entries(collection.schema)) {
      append({
        existing: true,
        name: field,
        required: options.required,
        type: options.type,
        unique: options.unique,
      })
    }
  }, [append, collection, setValue])

  React.useEffect(() => {
    if (collection || fields.length) {
      return
    }

    addNewField()
  }, [addNewField, collection, fields])

  const submitLabel = collection ? 'Update' : 'Create'

  return (
    <form className="w-[500px] pb-4" onSubmit={handleSubmit(save)}>
      <label>
        <div>Name</div>
        <Input
          className="block w-full"
          type="text"
          {...register('name', { required: true })}
        />
      </label>

      <div className="text-slate-500 dark:text-neutral-400">
        This becomes the table/collection name and endpoint
      </div>

      <div className="mt-3 grid grid-cols-12">
        <div className="col-span-6">
          <label>
            <input
              checked={true}
              type="checkbox"
              value="expose"
              {...register('options')}
              className="me-2"
            />
            Expose
          </label>

          <p className="text-slate-500 dark:text-neutral-400 ms-5">
            Check this if this collection should have a public endpoint. See{' '}
            <Link to="/docs" className="underline">
              docs
            </Link>
          </p>
        </div>

        <div className="col-span-6">
          <label>
            <input
              type="checkbox"
              value="is-template"
              {...register('options')}
              className="me-2"
            />
            Use as template
          </label>

          <p className="text-slate-500 dark:text-neutral-400 mt-0 ms-5">
            Allow this collection to be used to validate fields of other
            collections
          </p>
        </div>
      </div>

      <fieldset className="mt-8">
        <legend>Fields</legend>

        {fields.map((field, i) => (
          <Field
            key={field.id}
            onRemove={() => handleRemove(i)}
            onRestore={() => handleRestore(i)}
            register={(f: string, o?: RegisterOptions) =>
              register(`fields.${i}.${f}`, o)
            }
            watch={(key) => watch(`fields.${i}.${key}`)}
          />
        ))}

        <Button className="mt-3" onClick={addNewField} type="button">
          Add new field
        </Button>
      </fieldset>

      <footer>
        <p className="my-8">
          <Chip className="py-0">created_at</Chip> and{' '}
          <Chip className="py-0">updated_at</Chip> fields are automatically set
        </p>

        <div>
          <Button className="me-2" variant="primary">
            {submitLabel}
          </Button>
          <Button onClick={() => handleOnHide()} type="reset">
            Cancel
          </Button>
        </div>
      </footer>
    </form>
  )
}

function schemaFromForm(fields: FieldProps[]) {
  const schema: Record<string, any> = {}
  // `existing` doesn't go to backend
  for (const { name, removed, existing, ...options } of fields) {
    if (removed) {
      continue
    }

    schema[name] = options
  }

  return schema
}

function indexesFromForm(fields: FieldProps[]) {
  const indexes = []
  for (const { name, removed, unique } of fields) {
    if (removed || !unique) {
      continue
    }

    indexes.push({ fields: [name], options: { unique: true } })
  }

  return indexes
}

export default CollectionForm
