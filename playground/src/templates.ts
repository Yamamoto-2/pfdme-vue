import type { Template } from '@pdfme/common';

export const blankTemplate: Template = {
  basePdf: {
    width: 210,
    height: 297,
    padding: [20, 20, 20, 20],
  },
  schemas: [
    [
      {
        name: 'name',
        type: 'text',
        position: { x: 25, y: 30 },
        width: 70,
        height: 10,
        content: 'John Doe',
      },
      {
        name: 'title',
        type: 'text',
        position: { x: 25, y: 45 },
        width: 100,
        height: 8,
        content: 'Software Engineer',
      },
    ],
  ],
};

export const invoiceTemplate: Template = {
  basePdf: {
    width: 210,
    height: 297,
    padding: [10, 10, 10, 10],
  },
  schemas: [
    [
      {
        name: 'companyName',
        type: 'text',
        position: { x: 15, y: 15 },
        width: 80,
        height: 12,
        content: 'ACME Corp',
        readOnly: true,
      },
      {
        name: 'invoiceTitle',
        type: 'text',
        position: { x: 130, y: 15 },
        width: 60,
        height: 12,
        content: 'INVOICE',
        readOnly: true,
      },
      {
        name: 'invoiceNumber',
        type: 'text',
        position: { x: 130, y: 30 },
        width: 60,
        height: 8,
        content: '#INV-001',
      },
      {
        name: 'date',
        type: 'text',
        position: { x: 130, y: 40 },
        width: 60,
        height: 8,
        content: '2026-04-08',
      },
      {
        name: 'clientName',
        type: 'text',
        position: { x: 15, y: 55 },
        width: 80,
        height: 8,
        content: 'Client Name',
      },
      {
        name: 'clientAddress',
        type: 'text',
        position: { x: 15, y: 65 },
        width: 80,
        height: 8,
        content: '123 Street, City',
      },
      {
        name: 'item1',
        type: 'text',
        position: { x: 15, y: 90 },
        width: 100,
        height: 8,
        content: 'Web Development Service',
      },
      {
        name: 'amount1',
        type: 'text',
        position: { x: 150, y: 90 },
        width: 40,
        height: 8,
        content: '$5,000',
      },
      {
        name: 'total',
        type: 'text',
        position: { x: 150, y: 120 },
        width: 40,
        height: 10,
        content: '$5,000',
      },
    ],
  ],
};

export const certificateTemplate: Template = {
  basePdf: {
    width: 297,
    height: 210,
    padding: [15, 15, 15, 15],
  },
  schemas: [
    [
      {
        name: 'certificateTitle',
        type: 'text',
        position: { x: 60, y: 30 },
        width: 180,
        height: 15,
        content: 'Certificate of Completion',
        readOnly: true,
      },
      {
        name: 'recipientName',
        type: 'text',
        position: { x: 80, y: 70 },
        width: 140,
        height: 12,
        content: 'Jane Smith',
      },
      {
        name: 'courseName',
        type: 'text',
        position: { x: 60, y: 100 },
        width: 180,
        height: 10,
        content: 'Advanced Vue.js Development',
      },
      {
        name: 'completionDate',
        type: 'text',
        position: { x: 100, y: 130 },
        width: 100,
        height: 8,
        content: 'April 8, 2026',
      },
      {
        name: 'issuerName',
        type: 'text',
        position: { x: 100, y: 160 },
        width: 100,
        height: 8,
        content: 'Training Academy',
        readOnly: true,
      },
    ],
  ],
};
