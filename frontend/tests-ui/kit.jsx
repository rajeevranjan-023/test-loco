import React, { useState } from 'react'
export const call = (m, path, body) => globalThis.__api(m, path, body)
export function useSeller(path) { const data = globalThis.__seller ? globalThis.__seller(path) : []; return { data, loading: false, error: '', reload() {} } }
export const Modal = ({ title, children, onClose }) => <div data-modal={title}><h4>{title}</h4>{children}</div>
export const Field = ({ label, ...p }) => <label>{label}<input {...p} /></label>
