import { createContext, useContext } from "react"

export const SubjectContext = createContext("국어")
export const useSubject = () => useContext(SubjectContext)

export const SubjectTypeContext = createContext("korean")
export const useSubjectType = () => useContext(SubjectTypeContext)
