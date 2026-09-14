import type {InputHTMLAttributes} from 'react'
import TextInput from './TextInput'

/**
 * Identity and financial fields that must not be mistaken for sign-in credentials.
 * Browser autofill is advisory, so include the opt-outs understood by common
 * password managers as well as the standard autocomplete hint.
 */
export default function PrivateFormInput({autoComplete='off',...props}:InputHTMLAttributes<HTMLInputElement>){
 return <TextInput {...props} autoComplete={autoComplete} data-1p-ignore="true" data-lpignore="true" data-bwignore="true" data-form-type="other"/>
}
