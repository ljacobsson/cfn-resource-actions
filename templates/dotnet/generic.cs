using System.Threading.Tasks;
using Amazon.Lambda.Core;
using Amazon.Lambda.APIGatewayEvents;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.Json.JsonSerializer))]
namespace NAMESPACENAME
{
    public class CLASSNAME
    {
        public async Task<ReturnObject> HANDLERNAME(RequestObject event, ILambdaContext context)
        {
        }
    }
}
