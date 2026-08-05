import React from 'react';
import { Eye, CheckCircle2, RefreshCw, MinusCircle } from 'lucide-react';

export default function ImportPreviewTable({ previewData, importType }) {
  if (!Array.isArray(previewData) || previewData.length === 0) return null;

  return (
    <div className="bg-bg-sidebar/80 border border-border-card rounded-xl overflow-hidden p-5 space-y-3">
      <div className="flex items-center space-x-2">
        <Eye className="w-4 h-4 text-blue-400" />
        <h4 className="text-sm font-semibold text-text-main">
          Sample Preview (First {previewData.length} Valid Rows)
        </h4>
      </div>

      <div className="overflow-x-auto border border-border-card/80 rounded-lg">
        <table className="w-full text-left text-xs text-text-main">
          <thead className="bg-bg-card/80 text-text-muted font-semibold border-b border-border-card">
            {importType === 'STUDENT' && (
              <tr>
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Batch</th>
                <th className="py-2.5 px-3">Section</th>
              </tr>
            )}

            {importType === 'FACULTY' && (
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Designation</th>
              </tr>
            )}

            {importType === 'MARKS' && (
              <tr>
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Subject Code</th>
                <th className="py-2.5 px-3">Exam Type</th>
                <th className="py-2.5 px-3 text-center">Marks</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            )}

            {importType === 'TIMETABLE' && (
              <tr>
                <th className="py-2.5 px-3">Day Of Week</th>
                <th className="py-2.5 px-3 text-center">Period Range</th>
                <th className="py-2.5 px-3">Subject ID</th>
                <th className="py-2.5 px-3">Room ID</th>
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-700/60 bg-bg-sidebar/40 font-mono">
            {previewData.map((row, idx) => (
              <tr key={idx} className="hover:bg-bg-input/30 transition-colors">
                {importType === 'STUDENT' && (
                  <>
                    <td className="py-2.5 px-3 text-blue-400 font-bold">{row.rollNo}</td>
                    <td className="py-2.5 px-3 text-text-main font-sans">{row.name}</td>
                    <td className="py-2.5 px-3 text-text-main font-sans">{row.email}</td>
                    <td className="py-2.5 px-3">{row.batchYear}</td>
                    <td className="py-2.5 px-3">{row.section}</td>
                  </>
                )}

                {importType === 'FACULTY' && (
                  <>
                    <td className="py-2.5 px-3 text-text-main font-sans font-medium">{row.name}</td>
                    <td className="py-2.5 px-3 text-blue-400 font-sans">{row.email}</td>
                    <td className="py-2.5 px-3 text-text-main font-sans">{row.designation}</td>
                  </>
                )}

                {importType === 'MARKS' && (
                  <>
                    <td className="py-2.5 px-3 text-blue-400 font-bold">{row.rollNo}</td>
                    <td className="py-2.5 px-3 text-text-main">{row.subjectCode}</td>
                    <td className="py-2.5 px-3 font-sans text-text-main">{row.examType}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-100">
                      {row.marksObtained} / {row.maxMarks}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.action === 'CREATE' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px] font-sans font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CREATE</span>
                        </span>
                      )}
                      {row.action === 'UPDATE' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[11px] font-sans font-semibold">
                          <RefreshCw className="w-3 h-3" />
                          <span>UPDATE</span>
                        </span>
                      )}
                      {row.action === 'NO-OP' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-bg-input/60 text-text-muted border border-border-card/50 rounded text-[11px] font-sans font-semibold">
                          <MinusCircle className="w-3 h-3" />
                          <span>NO-OP</span>
                        </span>
                      )}
                    </td>
                  </>
                )}

                {importType === 'TIMETABLE' && (
                  <>
                    <td className="py-2.5 px-3 font-sans text-text-main">Day {row.dayOfWeek}</td>
                    <td className="py-2.5 px-3 text-center text-blue-400 font-bold">
                      P{row.startPeriodId?.slice(0, 4) || row.startPeriod} - P{row.endPeriodId?.slice(0, 4) || row.endPeriod}
                    </td>
                    <td className="py-2.5 px-3 text-text-muted text-[11px]">{row.subjectId}</td>
                    <td className="py-2.5 px-3 text-text-main font-sans">{row.roomId || 'Unassigned'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
