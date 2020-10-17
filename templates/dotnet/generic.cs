using System.Threading.Tasks;
using Amazon.Lambda.Core;

namespace NAMESPACENAME
{
    public class CLASSNAME
    {
        [LambdaSerializer(typeof(Amazon.Lambda.Serialization.Json.JsonSerializer))]
        public async Task<ReturnObject> HANDLERNAME(RequestObject event, ILambdaContext context)
        {
        }
    }
}
