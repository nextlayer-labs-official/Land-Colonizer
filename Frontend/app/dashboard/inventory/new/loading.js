export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center gap-3">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex-1 py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-20 bg-white rounded-lg border border-gray-200 animate-pulse" />
          {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}
