import { http, httpStatus } from '@/lib/http'
import type { Resource, SellerApplication, SellerDocumentType, ServiceArea } from '@/types/api'

export type ApplicationDetails = {
  store_name: string
  description: string
  contact_phone: string
  municipality: ServiceArea | ''
  barangay: string
  address_line: string
  business_type: 'individual' | 'registered_business'
  business_name: string
  business_registration_number: string
}

export type DocumentUpload = { key: number; type: SellerDocumentType; file: File | null }

export const serviceAreas: { value: ServiceArea; label: string }[] = [
  { value: 'vallehermoso', label: 'Vallehermoso' },
  { value: 'guihulngan', label: 'Guihulngan' },
  { value: 'san_carlos_city', label: 'San Carlos City' },
]

export const documentTypes: { value: SellerDocumentType; label: string }[] = [
  { value: 'government_id', label: 'Government-issued ID' },
  { value: 'business_permit', label: "Mayor's or business permit" },
  { value: 'dti_registration', label: 'DTI business name registration' },
  { value: 'sec_registration', label: 'SEC registration' },
  { value: 'bir_registration', label: 'BIR certificate of registration' },
  { value: 'other', label: 'Other supporting document' },
]

function toFormData(details: ApplicationDetails, documents: DocumentUpload[]) {
  const data = new FormData()
  Object.entries(details).forEach(([key, value]) => data.append(key, value))
  documents
    .filter((doc) => doc.file)
    .forEach((doc, index) => {
      data.append(`documents[${index}][type]`, doc.type)
      data.append(`documents[${index}][file]`, doc.file as File)
    })
  return data
}

export type ApplicationRequirements = { documents_required: boolean; required_documents: SellerDocumentType[] }

export const sellerApi = {
  async requirements(): Promise<ApplicationRequirements> {
    return (await http.get<Resource<ApplicationRequirements>>('/seller-application/requirements')).data.data
  },
  async mine(): Promise<SellerApplication | null> {
    try {
      return (await http.get<Resource<SellerApplication>>('/seller-application')).data.data
    } catch (error) {
      if (httpStatus(error) === 404) return null
      throw error
    }
  },
  async submit(details: ApplicationDetails, documents: DocumentUpload[]) {
    return (await http.post<Resource<SellerApplication>>('/seller-application', toFormData(details, documents))).data.data
  },
  async resubmit(details: ApplicationDetails, documents: DocumentUpload[]) {
    return (await http.post<Resource<SellerApplication>>('/seller-application/resubmit', toFormData(details, documents))).data.data
  },
}
